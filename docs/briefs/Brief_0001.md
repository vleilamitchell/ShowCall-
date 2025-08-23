We're building an inventory system for the application. Below, I asked ChatGPT: "I'm building an application to run my music venue/nightclub. It will be able to support all the departments, event management, inventory management, shift scheduling, etc. A comprehensive solution for both operations as well as financial management. I've gotten to inventory. Each department's inventory will be different and have different rules. Production and bar for example are enormously different. How do I design an inventory system that prevents having too much data fragmentation but allows for the flexibility to work with different departments?"

ChatGPT responded with the following:

Unify around a single inventory “core,” then let departments extend it via schemas and policies—don’t fork data models per department.

Core domain. Model one canonical Item with global identity (item_id), an item_type enum (Consumable, ReturnableAsset, FixedAsset, Perishable, Rental, Kit), a base_unit, and a single immutable InventoryLedger of movements. Everything that changes stock is a ledger event; current balances are projections. Locations (warehouse, bar well, truck, FOH rack) and Lots/Serials are first-class. Costing is attached to ledger events (avg/actual/FIFO), never to ad-hoc department tables.

Flexibility without fragmentation. Store type- and department-specific fields in an attributes JSONB column validated against a versioned AttributeSchema per item_type and optionally per department. That gives you strong validation and evolution without schema sprawl. Major types that truly diverge operationally (e.g., Consumable vs Asset) get slim subtype tables for critical constraints and indexes (table-per-type hybrid), while everything else lives in JSONB guarded by JSON Schema.

Policies > branches. Put rules in a Policy layer keyed by (department_id, item_type[, category_id]). Policies drive required attributes, UoM restrictions, who can post which ledger events, stock valuation method, par-level logic, maintenance SLAs, and whether reservations are required. Departments differ by policy and UI, not by data model.

Single movement model. Bar depletion, production check-out/check-in, maintenance holds, waste, transfers, counts, and POS sales all become InventoryTransaction rows with a normalized shape: timestamp, item_id, location_id, event_type, quantity_in_base_units, lot/serial refs, cost_ref, source_doc (PO, POS ticket, WorkOrder, EventID), and posted_by. Availability, COGS, and audit come from this one stream.

Units and packaging. Enforce a base_unit per item and maintain UoM conversions and package hierarchies (e.g., 1 case = 24 bottles, 1 bottle = 25.4 oz). The ledger records base units; UI can accept “2 cases + 3 bottles.” This prevents bar vs. warehouse drift.

Reservations and allocation. Add a Reservation table tied to EventID/WorkOrder for any non-consumable item_type. Reservations reduce “available” without posting a stock movement. Check-out creates a MOVE_OUT event; check-in a MOVE_IN event; maintenance sets AVAILABILITY=unavailable with a non-stock “status” event that still lives in the ledger for auditability.

Financial integration. Every ledger event maps to an accounting intent (e.g., Receipt→Inventory Asset↑; POS consumption→COGS↑, Inventory Asset↓; Waste→Shrinkage; Asset purchase→CapEx; Depreciation handled in GL but you can reflect a non-stock status). Charge costs to cost_centers (Bar, Lighting) and events; keep GL out of the inventory DB, but store the links so you can reconcile.

Department specifics without forks. Bar: Consumable/Perishable items with lot/expiry, par levels per Location, POS integration that batches depletions to the ledger, spillage/waste reasons, recipe support (BOM) to deplete components by pour size. Production: ReturnableAsset/FixedAsset with serials, service intervals, inspection checklists, kits (BOMs) that expand to components on reservation/checkout, damage reports, vendor rentals as shadow items with zero on-hand and payable tracking. Same Item table; different schemas/policies/UI.

Minimal schema sketch:

create type item_type as enum ('Consumable','ReturnableAsset','FixedAsset','Perishable','Rental','Kit');

create table attribute_schema (
  schema_id uuid primary key,
  item_type item_type not null,
  department_id uuid null,
  version int not null,
  json_schema jsonb not null,
  unique(item_type, department_id, version)
);

create table item (
  item_id uuid primary key,
  sku text unique not null,
  name text not null,
  item_type item_type not null,
  base_unit text not null,         -- e.g., 'ml','ea','oz'
  category_id uuid null,
  schema_id uuid not null references attribute_schema(schema_id),
  attributes jsonb not null,       -- validated against schema_id
  active boolean not null default true
);

-- optional subtype for assets
create table asset_specs (
  item_id uuid primary key references item(item_id),
  requires_serial boolean not null default true,
  service_interval_days int null
);

create table location (
  location_id uuid primary key,
  name text not null,
  department_id uuid not null
);

create type event_type as enum (
  'RECEIPT','TRANSFER_OUT','TRANSFER_IN','CONSUMPTION','WASTE',
  'COUNT_ADJUST','RESERVATION_HOLD','RESERVATION_RELEASE',
  'MOVE_OUT','MOVE_IN','MAINTENANCE_START','MAINTENANCE_END'
);

create table inventory_txn (
  txn_id uuid primary key,
  ts timestamptz not null default now(),
  item_id uuid not null references item(item_id),
  location_id uuid not null references location(location_id),
  event_type event_type not null,
  qty_base numeric not null,                 -- positive or negative
  lot_id uuid null,
  serial_no text null,
  cost_per_base numeric null,                -- for valuation events
  source_doc jsonb null,                     -- {type:'PO', id:'...', eventId:'...'}
  posted_by uuid not null
);

create table reservation (
  res_id uuid primary key,
  item_id uuid not null references item(item_id),
  location_id uuid not null references location(location_id),
  event_id uuid not null,
  qty_base numeric not null,
  start_ts timestamptz not null,
  end_ts timestamptz not null,
  status text not null check (status in ('HELD','RELEASED','FULFILLED'))
);

-- policy layer
create table policy (
  policy_id uuid primary key,
  department_id uuid not null,
  item_type item_type not null,
  key text not null,                 -- e.g., 'count_frequency_days','requires_reservation'
  value jsonb not null
);


Projections. Build materialized views or cached tables for OnHand (by item/location/lot), Availability (OnHand − Reservations in window), and Valuation (rolling average or FIFO layers by lot). These are derived—never hand-edited.

Search/naming. One global SKU per item. Allow department-scoped aliases via an ItemAlias table; never duplicate items to rename them.

Governance. Immutability on inventory_txn, append-only with corrective reversing entries; row-level security by department; audit columns and reason codes on adjustments and waste. Business logic lives in services with policy lookups, not in ad-hoc SQL.

UI/UX. Department-specific screens that speak their language (recipes, pours, par for Bar; kits, checklists, availability calendar for Production) but all screens post the same normalized ledger events.

Migration path. Start with the hybrid model (core + asset_specs + JSONB attributes). Define two attribute schemas: Bar.Consumable.v1 and Production.ReturnableAsset.v1. Implement policies for par levels and reservation requirements. Wire POS to post nightly consolidated CONSUMPTION. Wire check-out/check-in to MOVE_OUT/MOVE_IN with optional serials. Add cycle counts that produce COUNT_ADJUST deltas.

This gives you one source of truth and a single accounting spine, while letting each department express its quirks through validated attributes, policies, and workflows—not divergent tables.

