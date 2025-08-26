-- Drop unused artists columns
DO $$ BEGIN
  ALTER TABLE public.events DROP COLUMN IF EXISTS artists;
EXCEPTION WHEN undefined_column THEN
  -- ignore
END $$;

DO $$ BEGIN
  ALTER TABLE public.event_series DROP COLUMN IF EXISTS artists_template;
EXCEPTION WHEN undefined_column THEN
  -- ignore
END $$;


