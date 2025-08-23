-- Inventory Core (Phase 1)
-- Schema: public tables for now; app-level security enforced in service

-- Enums
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'item_type') THEN
    CREATE TYPE item_type AS ENUM ('Consumable', 'ReturnableAsset', 'FixedAsset', 'Perishable', 'Rental', 'Kit');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'event_type') THEN
    CREATE TYPE event_type AS ENUM ('RECEIPT','TRANSFER_OUT','TRANSFER_IN','CONSUMPTION','WASTE','COUNT_ADJUST','RESERVATION_HOLD','RESERVATION_RELEASE','MOVE_OUT','MOVE_IN','MAINTENANCE_START','MAINTENANCE_END');
  END IF;
END $$;

-- Attribute Schemas
CREATE TABLE IF NOT EXISTS attribute_schema (
  schema_id uuid PRIMARY KEY,
  item_type item_type NOT NULL,
  department_id uuid,
  version int NOT NULL,
  json_schema jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_attribute_schema_identity ON attribute_schema (item_type, department_id, version);

-- Items
CREATE TABLE IF NOT EXISTS item (
  item_id uuid PRIMARY KEY,
  sku text UNIQUE NOT NULL,
  name text NOT NULL,
  item_type item_type NOT NULL,
  base_unit text NOT NULL,
  category_id uuid,
  schema_id uuid NOT NULL REFERENCES attribute_schema(schema_id),
  attributes jsonb NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_item_type ON item (item_type);
CREATE INDEX IF NOT EXISTS idx_item_category ON item (category_id);

-- Optional Asset Specs (1:1 with item)
CREATE TABLE IF NOT EXISTS asset_specs (
  item_id uuid PRIMARY KEY REFERENCES item(item_id) ON DELETE CASCADE,
  requires_serial boolean DEFAULT true,
  service_interval_days int,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz
);

-- Locations (scoped by department)
CREATE TABLE IF NOT EXISTS location (
  location_id uuid PRIMARY KEY,
  name text NOT NULL,
  department_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_location_dept_name ON location (department_id, name);

-- Inventory Ledger (append-only)
CREATE TABLE IF NOT EXISTS inventory_txn (
  txn_id uuid PRIMARY KEY,
  ts timestamptz NOT NULL DEFAULT now(),
  item_id uuid NOT NULL REFERENCES item(item_id) ON DELETE RESTRICT,
  location_id uuid NOT NULL REFERENCES location(location_id) ON DELETE RESTRICT,
  event_type event_type NOT NULL,
  qty_base numeric NOT NULL,
  lot_id uuid,
  serial_no text,
  cost_per_base numeric,
  source_doc jsonb,
  posted_by uuid NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_inventory_txn_item_loc_ts ON inventory_txn (item_id, location_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_txn_event_ts ON inventory_txn (event_type, ts DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_txn_lot ON inventory_txn (lot_id);

-- Block updates/deletes on inventory_txn
CREATE OR REPLACE FUNCTION prevent_inventory_txn_update_delete() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'inventory_txn is append-only';
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_inventory_txn_no_update ON inventory_txn;
CREATE TRIGGER trg_inventory_txn_no_update
  BEFORE UPDATE OR DELETE ON inventory_txn
  FOR EACH ROW EXECUTE FUNCTION prevent_inventory_txn_update_delete();

-- Reservations
CREATE TABLE IF NOT EXISTS reservation (
  res_id uuid PRIMARY KEY,
  item_id uuid NOT NULL REFERENCES item(item_id) ON DELETE RESTRICT,
  location_id uuid NOT NULL REFERENCES location(location_id) ON DELETE RESTRICT,
  event_id uuid NOT NULL,
  qty_base numeric NOT NULL,
  start_ts timestamptz NOT NULL,
  end_ts timestamptz NOT NULL,
  status text NOT NULL CHECK (status IN ('HELD','RELEASED','FULFILLED')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_reservation_item_window ON reservation (item_id, start_ts, end_ts);
CREATE INDEX IF NOT EXISTS idx_reservation_event ON reservation (event_id);

-- Policies
CREATE TABLE IF NOT EXISTS policy (
  policy_id uuid PRIMARY KEY,
  department_id uuid NOT NULL,
  item_type item_type NOT NULL,
  key text NOT NULL,
  value jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_policy_identity ON policy (department_id, item_type, key);

-- Units and conversions
CREATE TABLE IF NOT EXISTS unit_conversion (
  from_unit text NOT NULL,
  to_unit text NOT NULL,
  factor numeric NOT NULL,
  PRIMARY KEY (from_unit, to_unit)
);


