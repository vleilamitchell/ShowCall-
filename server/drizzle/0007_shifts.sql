CREATE TABLE IF NOT EXISTS shifts (
  id text PRIMARY KEY,
  department_id text NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  schedule_id text REFERENCES schedules(id) ON DELETE SET NULL,
  date date NOT NULL,
  start_time text NOT NULL,
  end_time text NOT NULL,
  title text,
  notes text,
  event_id text REFERENCES events(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_shifts_dept_date_start ON shifts (department_id, date, start_time);
CREATE INDEX IF NOT EXISTS idx_shifts_schedule_id ON shifts (schedule_id);
CREATE INDEX IF NOT EXISTS idx_shifts_event_id ON shifts (event_id);


