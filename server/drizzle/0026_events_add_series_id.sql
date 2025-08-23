-- Alter table events: add series_id column and index
DO $$ BEGIN
  ALTER TABLE public.events ADD COLUMN IF NOT EXISTS series_id TEXT NULL REFERENCES public.event_series(id);
EXCEPTION WHEN duplicate_column THEN
  -- ignore
END $$;

CREATE INDEX IF NOT EXISTS events_series_id_date_idx ON public.events (series_id, date);


