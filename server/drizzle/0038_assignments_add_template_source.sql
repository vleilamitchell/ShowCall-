-- Assignments: add optional source_template_version_id for idempotent replace
alter table assignments add column if not exists source_template_version_id text null references event_template_versions(id) on delete set null;
create index if not exists idx_assignments_source_template_version on assignments(source_template_version_id);


