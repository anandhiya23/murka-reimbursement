-- Allow deleting requesters (admin uses service role, so this is just for completeness)
create policy "Allow delete requesters"
  on requesters for delete
  to authenticated
  using (true);
