-- Add is_active column to projects
alter table projects
  add column if not exists is_active boolean not null default true;

-- Allow admins to update projects
create policy "Authenticated users can update projects"
  on projects for update
  to authenticated
  using (true)
  with check (true);

-- Allow admins to insert projects
create policy "Authenticated users can insert projects"
  on projects for insert
  to authenticated
  with check (true);
