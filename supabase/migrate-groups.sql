-- ============================================================
-- Migration: Reimbursement Groups
-- ============================================================

-- 1. Create reimbursement_groups table
create table if not exists reimbursement_groups (
  id bigint generated always as identity primary key,
  group_code text not null unique,
  requester text not null,
  requester_email text,
  approver text not null,
  created_at timestamptz not null default now()
);

-- 2. Add FK column to reimbursements
alter table reimbursements
  add column if not exists group_id_fk bigint references reimbursement_groups(id) on delete cascade;

-- 3. Migrate existing data: insert distinct groups
insert into reimbursement_groups (group_code, requester, requester_email, approver, created_at)
select distinct on (r.group_id)
  r.group_id,
  r.requester,
  r.requester_email,
  r.approver,
  r.created_at
from reimbursements r
where r.group_id is not null and r.group_id != ''
order by r.group_id, r.created_at asc;

-- 4. For rows without a group_id, create individual groups
insert into reimbursement_groups (group_code, requester, requester_email, approver, created_at)
select
  '#solo-' || r.id,
  r.requester,
  r.requester_email,
  r.approver,
  r.created_at
from reimbursements r
where r.group_id is null or r.group_id = '';

-- 5. Backfill FK for rows that had group_id
update reimbursements r
set group_id_fk = g.id
from reimbursement_groups g
where r.group_id = g.group_code
  and r.group_id is not null and r.group_id != '';

-- 6. Backfill FK for solo rows
update reimbursements r
set group_id_fk = g.id
from reimbursement_groups g
where g.group_code = '#solo-' || r.id
  and (r.group_id is null or r.group_id = '');

-- 7. RLS
alter table reimbursement_groups enable row level security;

create policy "Authenticated users can read reimbursement_groups"
  on reimbursement_groups for select
  to authenticated
  using (true);

create policy "Authenticated users can insert reimbursement_groups"
  on reimbursement_groups for insert
  to authenticated
  with check (true);

create policy "Authenticated users can delete reimbursement_groups"
  on reimbursement_groups for delete
  to authenticated
  using (true);

-- 8. Index
create index if not exists idx_reimbursements_group_fk on reimbursements (group_id_fk);
create index if not exists idx_reimbursement_groups_created on reimbursement_groups (created_at);
