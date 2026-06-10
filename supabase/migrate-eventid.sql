-- =====================================================================
-- EventID app: events, divisions, PIC assignments, ID requests
-- RLS is permissive-authenticated (consistent with the rest of the app);
-- all real writes go through service-role API routes. Public submissions
-- have NO anon RLS surface — they flow only through service-role endpoints.
-- =====================================================================

create table if not exists eventid_events (
  id bigint generated always as identity primary key,
  name text not null,
  description text,
  starts_on date,
  ends_on date,
  is_open boolean not null default false,   -- gate: accepts public submissions
  public_token text unique,                 -- event-level public link token
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists eventid_divisions (
  id bigint generated always as identity primary key,
  event_id bigint not null references eventid_events(id) on delete cascade,
  name text not null,
  public_token text unique,                 -- division-level public link (locks form to this division)
  created_at timestamptz not null default now(),
  unique (event_id, name)
);
create index if not exists idx_eventid_divisions_event on eventid_divisions (event_id);

-- Many-to-many: a user (by email) can PIC many divisions; a division many PICs.
create table if not exists eventid_division_pics (
  id bigint generated always as identity primary key,
  division_id bigint not null references eventid_divisions(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now(),
  unique (division_id, email)
);
create index if not exists idx_eventid_division_pics_div on eventid_division_pics (division_id);
create index if not exists idx_eventid_division_pics_email on eventid_division_pics (lower(email));

create table if not exists eventid_requests (
  id bigint generated always as identity primary key,
  event_id bigint not null references eventid_events(id) on delete cascade,
  division_id bigint not null references eventid_divisions(id) on delete cascade,
  full_name text not null,
  photo_path text,           -- private bucket path (portrait)
  id_photo_path text,        -- private bucket path (gov ID scan — SENSITIVE)
  status text not null default 'pending',  -- pending | approved | rejected
  reviewed_by text,
  reviewed_at timestamptz,
  review_message text,
  submitted_via text,        -- 'event' | 'division'
  source_token text,         -- token used (audit)
  created_at timestamptz not null default now()
);
create index if not exists idx_eventid_requests_event on eventid_requests (event_id);
create index if not exists idx_eventid_requests_division on eventid_requests (division_id);
create index if not exists idx_eventid_requests_status on eventid_requests (status);

-- RLS: enable + permissive-authenticated read. No anon policies.
alter table eventid_events enable row level security;
alter table eventid_divisions enable row level security;
alter table eventid_division_pics enable row level security;
alter table eventid_requests enable row level security;

drop policy if exists "auth read events" on eventid_events;
create policy "auth read events" on eventid_events for select to authenticated using (true);

drop policy if exists "auth read divisions" on eventid_divisions;
create policy "auth read divisions" on eventid_divisions for select to authenticated using (true);

drop policy if exists "auth read pics" on eventid_division_pics;
create policy "auth read pics" on eventid_division_pics for select to authenticated using (true);

drop policy if exists "auth read requests" on eventid_requests;
create policy "auth read requests" on eventid_requests for select to authenticated using (true);

-- ---------------------------------------------------------------------
-- PRIVATE storage bucket for EventID photos (gov ID scans are sensitive).
-- Contrast: reimbursement 'receipts' is public. NO public read policy here —
-- access only via service-role signed URLs from API routes.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('eventid-photos', 'eventid-photos', false)
on conflict (id) do nothing;

-- Seam note: if multiple/expiring links per scope are ever needed, migrate the
-- public_token columns to a share_links(token, event_id, division_id,
-- expires_at, revoked) table. Not required for phase 1.
