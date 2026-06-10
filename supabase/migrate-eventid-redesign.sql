-- =====================================================================
-- EventID redesign: members-centric + slugs + auto member numbers.
-- Run AFTER migrate-eventid.sql. Idempotent-ish (guards where practical).
-- =====================================================================

-- Slug helper.
create or replace function slugify(txt text) returns text language sql immutable as $$
  select coalesce(
    nullif(trim(both '-' from regexp_replace(lower(coalesce(txt, '')), '[^a-z0-9]+', '-', 'g')), ''),
    'item'
  );
$$;

-- ---------- events: slug + member counter, drop token ----------
alter table eventid_events add column if not exists slug text;
alter table eventid_events add column if not exists member_counter int not null default 0;

update eventid_events set slug = slugify(name) where slug is null;
-- de-dupe by appending id to later collisions
update eventid_events e set slug = e.slug || '-' || e.id
where exists (select 1 from eventid_events o where o.slug = e.slug and o.id < e.id);

do $$ begin
  alter table eventid_events add constraint uq_event_slug unique (slug);
exception when duplicate_table then null; when duplicate_object then null; end $$;

alter table eventid_events drop column if exists public_token;

-- ---------- divisions: slug (unique within event), drop token ----------
alter table eventid_divisions add column if not exists slug text;

update eventid_divisions set slug = slugify(name) where slug is null;
update eventid_divisions d set slug = d.slug || '-' || d.id
where exists (
  select 1 from eventid_divisions o
  where o.event_id = d.event_id and o.slug = d.slug and o.id < d.id
);

do $$ begin
  alter table eventid_divisions add constraint uq_division_slug unique (event_id, slug);
exception when duplicate_table then null; when duplicate_object then null; end $$;

alter table eventid_divisions drop column if exists public_token;

-- ---------- requests -> members ----------
do $$ begin
  alter table eventid_requests rename to eventid_members;
exception when undefined_table then null; end $$;

alter table eventid_members add column if not exists source text not null default 'public';   -- public | pic
alter table eventid_members add column if not exists member_no text;
alter table eventid_members add column if not exists position text;
alter table eventid_members add column if not exists printed_at timestamptz;

-- status remap: pending->applicant, approved->member (rejected stays)
update eventid_members set status = 'applicant' where status = 'pending';
update eventid_members set status = 'member' where status = 'approved';

-- backfill member_no for existing members, per event, and set counters
with m as (
  select id, event_id, row_number() over (partition by event_id order by id) rn
  from eventid_members where status = 'member'
)
update eventid_members r set member_no = lpad(m.rn::text, 4, '0')
from m where m.id = r.id and r.member_no is null;

update eventid_events e set member_counter = coalesce(
  (select count(*) from eventid_members mm where mm.event_id = e.id and mm.status = 'member'), 0
);

-- Atomic per-event member number generator (used when a member is created).
create or replace function eventid_next_member_no(p_event bigint) returns text
language plpgsql as $$
declare n int;
begin
  update eventid_events set member_counter = member_counter + 1
  where id = p_event returning member_counter into n;
  return lpad(n::text, 4, '0');
end $$;

-- (RLS policies follow the renamed table automatically.)
