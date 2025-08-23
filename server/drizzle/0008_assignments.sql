CREATE TABLE IF NOT EXISTS assignments (
  id text PRIMARY KEY,
  department_id text NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  shift_id text NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  required_position_id text NOT NULL REFERENCES positions(id) ON DELETE RESTRICT,
  assignee_employee_id text REFERENCES employees(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_assignments_shift_id ON assignments (shift_id);
CREATE INDEX IF NOT EXISTS idx_assignments_dept_position ON assignments (department_id, required_position_id);
CREATE INDEX IF NOT EXISTS idx_assignments_assignee ON assignments (assignee_employee_id);


