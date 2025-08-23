-- Seed default attribute schemas for inventory item types
-- Safe to run multiple times due to ON CONFLICT DO NOTHING

INSERT INTO attribute_schema (schema_id, item_type, department_id, version, json_schema)
VALUES
  ('a1111111-1111-4111-8111-111111111111', 'Consumable', NULL, 1,
    '{
      "$schema": "http://json-schema.org/draft-07/schema#",
      "type": "object",
      "properties": {},
      "additionalProperties": true
    }'::jsonb
  ),
  ('a2222222-2222-4222-8222-222222222222', 'ReturnableAsset', NULL, 1,
    '{
      "$schema": "http://json-schema.org/draft-07/schema#",
      "type": "object",
      "properties": {},
      "additionalProperties": true
    }'::jsonb
  ),
  ('a3333333-3333-4333-8333-333333333333', 'FixedAsset', NULL, 1,
    '{
      "$schema": "http://json-schema.org/draft-07/schema#",
      "type": "object",
      "properties": {},
      "additionalProperties": true
    }'::jsonb
  ),
  ('a4444444-4444-4444-8444-444444444444', 'Perishable', NULL, 1,
    '{
      "$schema": "http://json-schema.org/draft-07/schema#",
      "type": "object",
      "properties": {},
      "additionalProperties": true
    }'::jsonb
  ),
  ('a5555555-5555-4555-8555-555555555555', 'Rental', NULL, 1,
    '{
      "$schema": "http://json-schema.org/draft-07/schema#",
      "type": "object",
      "properties": {},
      "additionalProperties": true
    }'::jsonb
  ),
  ('a6666666-6666-4666-8666-666666666666', 'Kit', NULL, 1,
    '{
      "$schema": "http://json-schema.org/draft-07/schema#",
      "type": "object",
      "properties": {},
      "additionalProperties": true
    }'::jsonb
  )
ON CONFLICT DO NOTHING;


