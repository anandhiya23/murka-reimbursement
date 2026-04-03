-- Create proof_files table for multiple files per reimbursement
create table if not exists proof_files (
  id bigint generated always as identity primary key,
  reimbursement_id bigint not null references reimbursements(id) on delete cascade,
  file_path text not null,
  file_name text not null,
  public_url text not null
);

create index if not exists idx_proof_files_reimbursement on proof_files (reimbursement_id);

-- RLS
alter table proof_files enable row level security;

create policy "Authenticated users can read proof_files"
  on proof_files for select
  to authenticated
  using (true);

create policy "Authenticated users can insert proof_files"
  on proof_files for insert
  to authenticated
  with check (true);
