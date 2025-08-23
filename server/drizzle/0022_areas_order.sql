-- Add sort_order to areas and initialize
ALTER TABLE "areas" ADD COLUMN IF NOT EXISTS "sort_order" integer NOT NULL DEFAULT 0;

-- Initialize existing rows to their current alphabetical order
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY name ASC) - 1 AS rn
  FROM areas
)
UPDATE areas a
SET sort_order = o.rn
FROM ordered o
WHERE a.id = o.id;

