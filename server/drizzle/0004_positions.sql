-- positions table
CREATE TABLE IF NOT EXISTS public.positions (
  id text PRIMARY KEY,
  department_id text NOT NULL,
  name text NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);


