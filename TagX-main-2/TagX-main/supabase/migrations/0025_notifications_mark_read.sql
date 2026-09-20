-- notifications_tenant_read (0018_storage_and_notifications.sql) is
-- select-only, deliberately noting "eventually mark-as-read" was still to
-- come. This is that: tenant members may update rows in their own
-- company only, so modules/notifications/mutations.ts can flip read_at.
-- Same trust model as every other *_tenant_isolation "for all" policy in
-- this schema — the app only ever writes read_at, RLS just needs to keep
-- the row inside the caller's own company.
create policy "notifications_tenant_mark_read" on public.notifications
  for update
  to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());
