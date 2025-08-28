-- Add user_id column to employees and unique index for 1:1 mapping
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS user_id text;

-- Optional: ensure uniqueness if provided
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_employees_user_id_unique'
  ) THEN
    CREATE UNIQUE INDEX idx_employees_user_id_unique ON employees (user_id) WHERE user_id IS NOT NULL;
  END IF;
END $$;


