ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "ticket_url" text;
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "event_page_url" text;
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "promo_assets_url" text;


