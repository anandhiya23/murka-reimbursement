-- Add is_admin column to requesters table
alter table requesters
  add column if not exists is_admin boolean not null default false;

-- Set admins
update requesters set is_admin = true where email in ('bintang@murka.id', 'alvinaldy@murka.id');
