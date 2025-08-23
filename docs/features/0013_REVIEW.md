### 0013 — Review: Inventory Core and Ledger

Summary
- Data layer implemented: enums, core tables, reservations, policies, units, and ledger with append-only enforcement. Projections created (`on_hand` MV, `availability` view) and valuation table scaffolded.
- Service layer added for items, transactions, reservations, and projection refresh. Inventory API routes mounted under `/api/v1/inventory`. UI adds sidebar entry and an `Inventory` page placeholder. Client API functions implemented for items, transactions, reservations, and locations.

Verification
- Migrations:
  - `server/drizzle/0009_inventory_core.sql`: creates `item_type`, `event_type` enums; tables `attribute_schema`, `item`, `asset_specs`, `location`, `inventory_txn` (with trigger blocking UPDATE/DELETE), `reservation`, `policy`, `unit_conversion`. Indexes present and reasonable.
  - `server/drizzle/0010_inventory_projections.sql`: creates `on_hand` materialized view, `availability` view (subtracts HELD reservations), and `valuation_avg` table.
- Schema modules:
  - `server/src/schema/inventory/items.ts`: defines Drizzle tables for the above; aggregated exports added in `server/src/schema/index.ts`.
  - `server/src/schema/inventory/enums.ts`: TS enums/types only (not wired as DB enum in Drizzle, which is acceptable given SQL enums exist).
- Validators:
  - `server/src/lib/validators.ts` includes `isValidUnit` and `isValidEventType` as planned.
- Services:
  - `server/src/services/inventory/items.ts`: list/create/get/patch for items.
  - `server/src/services/inventory/postTransaction.ts`: minimal posting; handles `TRANSFER_OUT`→`TRANSFER_IN`, inserts entries, refreshes projections.
  - `server/src/services/inventory/reservations.ts`: create/list/update (status RELEASE/FULFILL).
  - `server/src/services/inventory/projections.ts`: refreshes `on_hand` MV.
- API routes:
  - `server/src/api.ts`: mounts `/api/v1/inventory`; implements `GET/POST /items`, `GET/PATCH /items/:itemId`, `POST /transactions`, `GET/POST/PATCH /reservations`, `GET /locations`.
- UI:
  - `ui/src/components/appSidebar.tsx`: adds “Inventory”.
  - `ui/src/App.tsx`: adds route `/inventory`.
  - `ui/src/pages/Inventory.tsx`: placeholder dashboard.
  - `ui/src/lib/serverComm.ts`: client helpers for items, transactions, reservations, locations.

Issues & Gaps
- On-hand refresh will likely fail: `refreshOnHandMaterializedView` uses `REFRESH MATERIALIZED VIEW CONCURRENTLY on_hand`, but the MV lacks a UNIQUE index. PostgreSQL requires a unique index on a materialized view to use `CONCURRENTLY`.
- Availability calculation windowing: The `availability` view subtracts the total of HELD reservations without a time-window filter. The plan requires availability within a requested window; as written, availability will be understated when there are HELD reservations outside the query window.
- Missing attribute JSON Schema validation: No `ajv` integration; `createInventoryItem`/`patchInventoryItem` do not validate `attributes` against the `attribute_schema.json_schema`.
- Unit conversion not implemented: Services accept `qtyBase` only; no conversion logic from user-provided units to base units, despite `unit_conversion` table.
- Policy enforcement not implemented: `postTransaction` performs minimal validation; no checks for allowed `event_type`, reservation requirements, or par/valuation policy keys.
- Valuation not updated: `valuation_avg` table is created, but posting logic does not update rolling average or compute COGS for negative movements.
- Incomplete API surface vs plan:
  - Missing `GET /api/v1/inventory/transactions` for querying ledger entries.
  - `GET /api/v1/inventory/items/:itemId` returns only the item; it does not include on-hand/availability summary as specified.
  - `GET /api/v1/inventory/locations` lacks a `department_id` filter.
- Route mounting order comment drift: `app.route('/api/v1', api)` is called before defining inventory routes; functionally fine (same `api` instance), but contradicts the “mount at end” comment.
- UI scope (Phase 3) only partially started: Only `/inventory` dashboard placeholder; routes/pages for items list/detail, transactions, and reservations are not yet implemented.

Data shape/alignment observations
- Naming conventions are consistent: DB columns snake_case; Drizzle schema exposes camelCase fields (e.g., `itemId`, `baseUnit`). API query parameters use `item_type` for filtering which the client sets correctly.
- `eventType` is a string across API/client/services and validated via `isValidEventType`.

Recommendations
- Projections
  - Add a unique index on `on_hand (item_id, location_id, lot_id)` and keep `CONCURRENTLY`, or drop `CONCURRENTLY` if a unique index is undesirable.
  - Rework availability to be window-aware. Options:
    - Replace the `availability` view with a SQL function that takes `[start_ts, end_ts]` and subtracts overlapping HELD reservations; or
    - Keep `on_hand` MV and compute availability in queries/services with proper window filters.
- Validation and policies
  - Add `ajv` and validate `attributes` against `attribute_schema.json_schema` on item create/patch.
  - Implement unit conversion on transaction input when `unit` ≠ `baseUnit` using `unit_conversion`.
  - Enforce policies in `postTransaction` (allowed events, reservation requirements, etc.).
- Valuation
  - Update `valuation_avg` on `RECEIPT` and use it to compute COGS on negative movements; persist COGS reference.
- API completeness
  - Add `GET /inventory/transactions` with filters (`item_id`, `location_id`, `event_type`, `ts range`).
  - Enhance `GET /inventory/items/:itemId` to include on-hand/availability summary (and optional breakdown by location/lot).
  - Add `department_id` filter to `GET /inventory/locations`.
- UI
  - Implement pages/forms per plan: Items list/detail, transaction posting, reservations list.

Conclusion
- Phase 1 (data) is largely complete and correct. Phase 2A (algorithms) is partially implemented: basic posting, reservations, and projection refresh exist, but validation, policy enforcement, unit conversions, windowed availability, and valuation are still pending. Phase 2B (API breadth) and Phase 3 (UI) are partially done. Addressing the above items will align the implementation fully with the plan.


