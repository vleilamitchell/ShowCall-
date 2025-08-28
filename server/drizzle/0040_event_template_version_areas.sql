-- Event Template Version Areas (version-level allowed areas)
create table if not exists event_template_version_areas (
  template_version_id text not null references event_template_versions(id) on delete cascade,
  area_id text not null references areas(id) on delete restrict,
  primary key (template_version_id, area_id)
);


