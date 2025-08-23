-- employee_positions join table
CREATE TABLE IF NOT EXISTS public.employee_positions (
  id text PRIMARY KEY,
  department_id text NOT NULL,
  employee_id text NOT NULL,
  position_id text NOT NULL,
  priority integer,
  is_lead boolean NOT NULL DEFAULT false,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS employee_positions_unique
  ON public.employee_positions (department_id, employee_id, position_id);


