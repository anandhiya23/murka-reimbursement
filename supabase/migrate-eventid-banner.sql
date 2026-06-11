-- ---------------------------------------------------------------------
-- EventID: per-event banner image (1200x600). Used everywhere an event is
-- shown (public apply page, admin workspace, event list).
-- ---------------------------------------------------------------------

alter table eventid_events
  add column if not exists banner_path text;

-- PUBLIC storage bucket for banners. Unlike 'eventid-photos' (private gov-ID
-- scans), banners are marketing images surfaced on unauthenticated pages, so
-- the URL must be stable and readable without signing.
insert into storage.buckets (id, name, public)
values ('eventid-banners', 'eventid-banners', true)
on conflict (id) do nothing;

-- Public read; writes are service-role only (admin API routes).
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'eventid_banners_public_read'
  ) then
    create policy eventid_banners_public_read on storage.objects
      for select using (bucket_id = 'eventid-banners');
  end if;
end $$;
