-- Events: add template references
alter table events add column if not exists template_id text null references event_templates(id) on delete set null;
alter table events add column if not exists template_version_id text null references event_template_versions(id) on delete set null;
create index if not exists idx_events_template_version_id on events(template_version_id);


