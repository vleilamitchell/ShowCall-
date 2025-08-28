-- Event Template Versions
create table if not exists event_template_versions (
  id text primary key,
  template_id text not null references event_templates(id) on delete cascade,
  version_number integer not null,
  title_template text not null,
  notes text null,
  is_current boolean not null default false,
  updated_at timestamptz not null default now()
);

-- Unique per template
create unique index if not exists uniq_template_version on event_template_versions(template_id, version_number);
create index if not exists idx_template_versions_current on event_template_versions(template_id, is_current);


