-- ============================================================
-- Murka Reimbursement Portal – Seed Data + RLS + Auth
-- Run this in the Supabase SQL Editor
-- ============================================================

-- 1. Seed requesters
insert into requesters (name, email) values
  ('Bintang', 'bintang@murka.id'),
  ('Bobby', 'maharyudhaa@murka.id'),
  ('Arvi', 'ziyanunalvin@gmail.com'),
  ('Amin', 'minman.suryadi@gmail.com'),
  ('Wisnu', 'wisnu@murka.id'),
  ('Eza', 'eza@murka.id'),
  ('Amirah', 'amirah@murka.id'),
  ('Sadam', 'sadam@murka.id'),
  ('Chandra', 'mahardhika@murka.id'),
  ('Hanief', 'hanief@murka.id'),
  ('Argy', 'argy@murka.id'),
  ('Robby', 'robby@murka.id'),
  ('Dinno', 'dinno@murka.id'),
  ('Ayu', 'ayu@murka.id'),
  ('Alvinaldy', 'alvinaldy@murka.id')
on conflict (name) do update set email = excluded.email;

-- 2. Seed approvers
insert into approvers (name) values
  ('Alvinaldy Fitrah')
on conflict (name) do nothing;

-- 3. Seed projects
insert into projects (name) values
  ('Daily Operation'),
  ('Slola'),
  ('Glico Wings'),
  ('ApoTech+'),
  ('Pilkita'),
  ('Light+'),
  ('Pizza Hut'),
  ('Hampers Lebaran'),
  ('Bear Brand'),
  ('Bukber Trisakti'),
  ('Usaha Bareng AdaKami'),
  ('Wirasena Website')
on conflict (name) do nothing;

-- ============================================================
-- 4. Enable RLS on all tables
-- ============================================================
alter table reimbursements enable row level security;
alter table requesters enable row level security;
alter table approvers enable row level security;
alter table projects enable row level security;

-- ============================================================
-- 5. RLS Policies
-- ============================================================

-- Config tables: anyone authenticated can read
create policy "Authenticated users can read approvers"
  on approvers for select
  to authenticated
  using (true);

create policy "Authenticated users can read requesters"
  on requesters for select
  to authenticated
  using (true);

create policy "Authenticated users can read projects"
  on projects for select
  to authenticated
  using (true);

-- Reimbursements: authenticated users can read all (for the table view)
create policy "Authenticated users can read all reimbursements"
  on reimbursements for select
  to authenticated
  using (true);

-- Reimbursements: authenticated users can insert
create policy "Authenticated users can insert reimbursements"
  on reimbursements for insert
  to authenticated
  with check (true);

-- Storage: authenticated users can read and upload receipts
drop policy if exists "Allow public read receipts" on storage.objects;
drop policy if exists "Allow public insert receipts" on storage.objects;

create policy "Authenticated users can read receipts"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'receipts');

create policy "Authenticated users can upload receipts"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'receipts');
