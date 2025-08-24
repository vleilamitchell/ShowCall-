-- Add organization column to contacts
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS organization text;
-- Optional index for organization (helpful for filtering)
CREATE INDEX IF NOT EXISTS idx_contacts_org ON contacts (organization);


