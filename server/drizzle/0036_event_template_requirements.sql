-- Event Template Requirements and Allowed Areas
create table if not exists event_template_requirements (
  id text primary key,
  template_version_id text not null references event_template_versions(id) on delete cascade,
  required_position_id text not null references positions(id) on delete restrict,
  area_id text not null references areas(id) on delete restrict,
  count integer not null default 1 check (count > 0)
);


