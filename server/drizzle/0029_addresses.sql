-- addresses table and indexes per Feature 0025
create table if not exists addresses (
  id text primary key,
  entity_type text not null,
  entity_id text not null,
  role text,
  valid_from date,
  valid_to date,
  is_primary boolean not null default false,
  address_line_1 text not null,
  address_line_2 text,
  city text not null,
  county text,
  state char(2) not null,
  zip_code char(5) not null,
  zip_plus4 char(4),
  latitude numeric(9,6),
  longitude numeric(9,6),
  usps_standardized text,
  raw_input text,
  verified boolean not null default false,
  verification_date date,
  data_source text not null default 'manual',
  status text not null default 'active',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint chk_valid_dates check (valid_from is null or valid_to is null or valid_from <= valid_to)
);

create index if not exists idx_addresses_entity on addresses(entity_type, entity_id);

-- At most one primary address per entity per role
create unique index if not exists uniq_addresses_primary_per_role
  on addresses(entity_type, entity_id, role)
  where is_primary = true;


