-- Notifications: messages outbox and push tokens

create table if not exists app.messages (
  id text primary key,
  channel text not null,
  template_key text not null,
  "to" text not null,
  cc text,
  bcc text,
  subject text,
  body_preview text,
  status text not null,
  provider_id text,
  error text,
  ctx_employee_id text,
  ctx_schedule_id text,
  ctx_shift_id text,
  ctx_assignment_id text,
  ctx_event_id text,
  dedupe_key text unique,
  created_at timestamptz default now() not null,
  sent_at timestamptz,
  updated_at timestamptz default now() not null
);

create index if not exists idx_messages_channel_status on app.messages(channel, status);
create index if not exists idx_messages_created_at on app.messages(created_at desc);
create index if not exists idx_messages_context on app.messages(ctx_employee_id, ctx_schedule_id, ctx_shift_id, ctx_assignment_id, ctx_event_id);

create table if not exists app.push_tokens (
  id text primary key,
  user_id text not null,
  provider text not null,
  token text not null,
  platform text not null,
  last_seen_at timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index if not exists idx_push_tokens_user on app.push_tokens(user_id);
create unique index if not exists uniq_push_token on app.push_tokens(token);


