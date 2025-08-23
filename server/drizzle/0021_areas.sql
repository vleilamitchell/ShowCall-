-- Areas master table
CREATE TABLE IF NOT EXISTS "areas" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "description" text,
  "color" text,
  "active" boolean NOT NULL DEFAULT true,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

-- Uniqueness and lookup indexes
CREATE UNIQUE INDEX IF NOT EXISTS "areas_name_unique" ON "areas" ("name");
CREATE INDEX IF NOT EXISTS "areas_active_idx" ON "areas" ("active");

-- Event to Areas join table (many-to-many)
CREATE TABLE IF NOT EXISTS "event_areas" (
  "event_id" text NOT NULL,
  "area_id" text NOT NULL,
  "added_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_areas_pk PRIMARY KEY ("event_id", "area_id"),
  CONSTRAINT event_areas_event_fk FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE,
  CONSTRAINT event_areas_area_fk FOREIGN KEY ("area_id") REFERENCES "areas"("id") ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS "event_areas_event_idx" ON "event_areas" ("event_id");
CREATE INDEX IF NOT EXISTS "event_areas_area_idx" ON "event_areas" ("area_id");


