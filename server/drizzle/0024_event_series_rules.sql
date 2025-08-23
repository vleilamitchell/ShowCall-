-- Create table: event_series_rules
CREATE TABLE IF NOT EXISTS public.event_series_rules (
  id TEXT PRIMARY KEY,
  series_id TEXT NOT NULL REFERENCES public.event_series(id) ON DELETE CASCADE,
  frequency TEXT NOT NULL,
  interval INT NOT NULL DEFAULT 1,
  by_weekday_mask INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS event_series_rules_series_idx ON public.event_series_rules (series_id);


