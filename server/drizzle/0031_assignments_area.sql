-- Add optional area reference to assignments
ALTER TABLE assignments
ADD COLUMN IF NOT EXISTS area_id text REFERENCES areas(id) ON DELETE SET NULL;

-- Helpful index for querying by shift and area
CREATE INDEX IF NOT EXISTS idx_assignments_shift_area ON assignments (shift_id, area_id);


