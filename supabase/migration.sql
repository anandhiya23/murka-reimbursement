-- ============================================================
-- Murka Reimbursement Portal – Supabase Migration
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- 1. Config tables (dropdown options)
create table if not exists approvers (
  id bigint generated always as identity primary key,
  name text not null unique
);

create table if not exists requesters (
  id bigint generated always as identity primary key,
  name text not null unique,
  email text
);

create table if not exists projects (
  id bigint generated always as identity primary key,
  name text not null unique
);

-- 2. Main reimbursement table
create table if not exists reimbursements (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  requester text not null,
  project text not null,
  expense_date text not null,
  description text,
  amount numeric not null default 0,
  proof_url text,            -- Supabase Storage path or legacy Google Drive link
  approver text not null,
  status text not null default 'Pending',
  group_id text,             -- e.g. #260403-5
  requester_email text       -- denormalized from requesters table
);

-- 3. Index for common queries
create index if not exists idx_reimbursements_status on reimbursements (status);
create index if not exists idx_reimbursements_requester on reimbursements (requester);

-- 4. Storage bucket for receipt proof files
-- NOTE: Run this separately if it fails (some Supabase plans require
-- bucket creation via Dashboard > Storage instead of SQL)
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', true)
on conflict (id) do nothing;

-- 5. Storage policy: allow public reads and authenticated uploads
-- For a simple internal tool without auth, allow anonymous access
create policy "Allow public read receipts"
  on storage.objects for select
  using (bucket_id = 'receipts');

create policy "Allow public insert receipts"
  on storage.objects for insert
  with check (bucket_id = 'receipts');

-- ============================================================
-- After running this migration, populate the config tables
-- with your existing dropdown values. Example:
--
-- insert into approvers (name) values ('John'), ('Jane');
-- insert into requesters (name, email) values ('Alice', 'alice@example.com');
-- insert into projects (name) values ('Project Alpha'), ('Project Beta');
-- ============================================================
