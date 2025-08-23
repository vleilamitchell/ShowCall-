CREATE TABLE IF NOT EXISTS "events" (
  "id" text PRIMARY KEY,
  "title" text NOT NULL,
  "promoter" text,
  "status" text NOT NULL,
  "date" text NOT NULL,
  "start_time" text NOT NULL,
  "end_time" text NOT NULL,
  "description" text,
  "artists" text,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

-- Indexes to support filtering and sorting
CREATE INDEX IF NOT EXISTS "events_date_start_end_idx" ON "events" ("date", "start_time", "end_time");
CREATE INDEX IF NOT EXISTS "events_status_idx" ON "events" ("status");
CREATE INDEX IF NOT EXISTS "events_title_idx" ON "events" ("title");
CREATE INDEX IF NOT EXISTS "events_promoter_idx" ON "events" ("promoter");

