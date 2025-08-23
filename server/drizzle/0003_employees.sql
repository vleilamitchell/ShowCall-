CREATE TABLE IF NOT EXISTS "employees" (
  "id" text PRIMARY KEY,
  "department_id" text NOT NULL,
  "name" text NOT NULL,
  "priority" integer,
  "first_name" text,
  "middle_name" text,
  "last_name" text,
  "address1" text,
  "address2" text,
  "city" text,
  "state" text,
  "postal_code" text,
  "postal_code4" text,
  "primary_phone" text,
  "email" text,
  "emergency_contact_name" text,
  "emergency_contact_phone" text,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

-- Foreign key to departments
DO $$ BEGIN
  ALTER TABLE "employees" ADD CONSTRAINT "employees_department_id_fkey"
    FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Indexes for filtering
CREATE INDEX IF NOT EXISTS "employees_department_idx" ON "employees" ("department_id");
CREATE INDEX IF NOT EXISTS "employees_name_idx" ON "employees" ("name");


