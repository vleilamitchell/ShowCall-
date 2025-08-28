-- Event Series: optional template version reference
alter table event_series add column if not exists template_version_id text null references event_template_versions(id) on delete set null;
create index if not exists idx_event_series_template_version on event_series(template_version_id);


