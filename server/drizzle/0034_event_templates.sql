-- Event Templates core table
create table if not exists event_templates (
  id text primary key,
  name text not null,
  description text null,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

-- Optional uniqueness on name for convenience
create unique index if not exists event_templates_name_unique on event_templates(name);
create index if not exists idx_event_templates_active on event_templates(active);


