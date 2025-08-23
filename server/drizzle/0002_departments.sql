CREATE TABLE IF NOT EXISTS "departments" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "description" text,
  "updated_at" timestamptz DEFAULT now()
);

-- Indexes for basic filtering and ordering
CREATE INDEX IF NOT EXISTS "departments_name_idx" ON "departments" ("name");


