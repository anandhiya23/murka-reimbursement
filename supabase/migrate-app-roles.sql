-- =====================================================================
-- Multi-app roles foundation
-- Keeps `requesters` canonical for reimbursement; layers generic per-app
-- roles on top, keyed by email (same join key as requesters -> auth.users).
-- =====================================================================

-- Per-app role assignments.
create table if not exists user_app_roles (
  id bigint generated always as identity primary key,
  email text not null,
  app_key text not null,              -- 'reimbursement' | 'eventid'
  role text not null,                 -- 'admin' | 'requester' | 'pic'
  created_at timestamptz not null default now(),
  unique (email, app_key, role)
);
create index if not exists idx_user_app_roles_email on user_app_roles (lower(email));
create index if not exists idx_user_app_roles_app on user_app_roles (app_key);

-- Global super-admin: full access to every app.
create table if not exists super_admins (
  email text primary key
);

-- RLS: permissive-authenticated read (consistent with the rest of the app).
-- All writes happen via the service-role client in API routes.
alter table user_app_roles enable row level security;
alter table super_admins enable row level security;

drop policy if exists "auth read user_app_roles" on user_app_roles;
create policy "auth read user_app_roles" on user_app_roles
  for select to authenticated using (true);

drop policy if exists "auth read super_admins" on super_admins;
create policy "auth read super_admins" on super_admins
  for select to authenticated using (true);

-- ---------------------------------------------------------------------
-- Backfill from existing reimbursement users (preserves current behavior).
-- ---------------------------------------------------------------------
insert into user_app_roles (email, app_key, role)
select lower(email), 'reimbursement',
       case when is_admin then 'admin' else 'requester' end
from requesters
where email is not null
on conflict (email, app_key, role) do nothing;

-- Seed super-admins (the existing hardcoded admin emails).
insert into super_admins (email) values
  ('bintang@murka.id'),
  ('alvinaldy@murka.id')
on conflict (email) do nothing;
