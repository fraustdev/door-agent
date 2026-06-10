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

create table visitors (
  id         uuid        primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  name       text        not null,
  added_by   text,
  date       date        not null default current_date
);

create index visitors_date_idx on visitors (date);
