-- Create table: event_series_areas (join between series and areas)
CREATE TABLE IF NOT EXISTS public.event_series_areas (
  series_id TEXT NOT NULL REFERENCES public.event_series(id) ON DELETE CASCADE,
  area_id TEXT NOT NULL REFERENCES public.areas(id),
  PRIMARY KEY (series_id, area_id)
);


