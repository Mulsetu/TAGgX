-- Hardening from the Supabase security advisor. Backward compatible: the
-- currently deployed app keeps working unchanged.

-- 1. adjust_storage_used: also accept calls made with the service-role key.
--    The app now updates the storage counter server-side with that key
--    (modules/storage/mutations.ts). Migration 0056 then removes direct
--    access for signed-in users, who could otherwise call this RPC with a
--    negative delta to reset their own company's usage and slip past the
--    plan's storage limit. Apply 0056 only after the app change is deployed.
create or replace function public.adjust_storage_used(p_company_id uuid, p_delta bigint)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  used bigint;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role'
     and p_company_id is distinct from public.current_company_id()
     and not public.is_super_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  insert into public.company_settings (company_id, storage_used_bytes)
  values (p_company_id, greatest(p_delta, 0))
  on conflict (company_id) do update
    set storage_used_bytes = greatest(company_settings.storage_used_bytes + p_delta, 0)
  returning storage_used_bytes into used;

  return used;
end;
$$;

-- 2. check_storage_thresholds only runs from the hourly pg_cron job (as
--    postgres). Nobody needs it through the API; signed-out visitors could
--    call it via /rest/v1/rpc/check_storage_thresholds.
revoke execute on function public.check_storage_thresholds() from public, anon, authenticated;

-- 3. Pin search_path on the two trigger functions that didn't set it.
alter function public.set_updated_at() set search_path = public;
alter function public.check_slug_not_reserved() set search_path = public;
