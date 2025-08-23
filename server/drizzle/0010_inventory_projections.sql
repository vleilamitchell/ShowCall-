-- Inventory projections: on_hand, availability, valuation (rolling avg placeholder)

-- On-hand materialized view (by item/location/lot)
CREATE MATERIALIZED VIEW IF NOT EXISTS on_hand AS
SELECT 
  item_id,
  location_id,
  lot_id,
  SUM(qty_base) AS qty_base
FROM inventory_txn
GROUP BY item_id, location_id, lot_id;

CREATE INDEX IF NOT EXISTS idx_on_hand_item_loc ON on_hand (item_id, location_id);

-- Availability view: on_hand minus active reservations in window
CREATE OR REPLACE VIEW availability AS
SELECT 
  oh.item_id,
  oh.location_id,
  oh.lot_id,
  oh.qty_base 
    - COALESCE(
        (
          SELECT SUM(r.qty_base)
          FROM reservation r
          WHERE r.item_id = oh.item_id
            AND r.location_id = oh.location_id
            AND r.status = 'HELD'
            -- Window filter is applied at query time via WHERE; here we precompute total held
        ), 0
      ) AS available_qty_base
FROM on_hand oh;

-- Valuation table (rolling average per item)
CREATE TABLE IF NOT EXISTS valuation_avg (
  item_id uuid PRIMARY KEY,
  avg_cost numeric NOT NULL DEFAULT 0,
  qty_base numeric NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);


