-- ============================================================
-- Migration: Admin review + email/password auth support
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Add review columns to reimbursements
alter table reimbursements
  add column if not exists reviewed_by text,
  add column if not exists reviewed_at timestamptz,
  add column if not exists review_message text;

-- 2. Allow authenticated users to update reimbursements (for admin approval/rejection)
create policy "Authenticated users can update reimbursements"
  on reimbursements for update
  to authenticated
  using (true)
  with check (true);

-- 3. Index for faster admin queries on pending items
create index if not exists idx_reimbursements_created_at on reimbursements (created_at);
