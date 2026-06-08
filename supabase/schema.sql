create table access_log (
  id             uuid        primary key default gen_random_uuid(),
  created_at     timestamptz default now(),
  caller_id      text        not null,
  word_spoken    text        not null,
  word_expected  text,
  match_distance int,
  granted        boolean     not null,
  locked_out     boolean     not null default false
);

-- Index for dashboard queries: recent attempts per caller, most recent first
create index access_log_created_at_idx on access_log (created_at desc);
create index access_log_caller_id_idx  on access_log (caller_id);

create table calendar_connections (
  id            uuid        primary key default gen_random_uuid(),
  created_at    timestamptz default now(),
  email         text        not null unique,
  display_name  text,
  refresh_token text        not null,
  access_token  text,
  token_expiry  timestamptz
);
