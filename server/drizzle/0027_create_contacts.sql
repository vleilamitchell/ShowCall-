-- Create contacts table
CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  prefix TEXT,
  first_name TEXT,
  last_name TEXT,
  suffix TEXT,
  address1 TEXT,
  address2 TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  email TEXT,
  payment_details TEXT,
  contact_number TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes to support ordering
CREATE INDEX IF NOT EXISTS idx_contacts_last_first ON contacts (last_name, first_name);

