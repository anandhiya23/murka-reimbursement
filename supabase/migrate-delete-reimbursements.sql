-- Allow deleting reimbursements
create policy "Authenticated users can delete reimbursements"
  on reimbursements for delete
  to authenticated
  using (true);

-- Allow deleting proof_files
create policy "Authenticated users can delete proof_files"
  on proof_files for delete
  to authenticated
  using (true);

-- Allow deleting storage objects
create policy "Authenticated users can delete receipts"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'receipts');
