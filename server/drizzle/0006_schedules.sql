CREATE TABLE IF NOT EXISTS schedules (
  id text PRIMARY KEY,
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_published boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_schedules_start_end ON schedules (start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_schedules_is_published ON schedules (is_published);


