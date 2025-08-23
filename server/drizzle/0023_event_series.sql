-- Create table: event_series
CREATE TABLE IF NOT EXISTS public.event_series (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NULL,
  start_date TEXT NULL,
  end_date TEXT NULL,
  default_status TEXT NOT NULL DEFAULT 'planned',
  default_start_time TEXT NOT NULL DEFAULT '00:00',
  default_end_time TEXT NOT NULL DEFAULT '23:59',
  title_template TEXT NULL,
  promoter_template TEXT NULL,
  artists_template TEXT NULL,
  template_json JSONB NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


