-- Add event_type and priority to events
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS event_type text,
  ADD COLUMN IF NOT EXISTS priority integer;

-- Normalize any out-of-range existing data before adding the constraint
UPDATE events SET priority = NULL WHERE priority IS NOT NULL AND (priority < 0 OR priority > 5);

-- Optional: lightweight check constraint for reasonable priority range
DO $$ BEGIN
  ALTER TABLE events
    ADD CONSTRAINT chk_events_priority_range CHECK (priority IS NULL OR (priority >= 0 AND priority <= 5));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


