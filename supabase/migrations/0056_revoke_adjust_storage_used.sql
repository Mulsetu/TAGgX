-- APPLY ONLY AFTER the app version that calls adjust_storage_used with the
-- service-role key (modules/storage/mutations.ts) is deployed. Older app
-- versions call it as the signed-in user and would stop updating the
-- storage counter.
--
-- Signed-in users could call /rest/v1/rpc/adjust_storage_used directly with
-- a negative delta to zero their company's usage and bypass the plan's
-- storage limit. Only the server (service role) adjusts it now.
revoke execute on function public.adjust_storage_used(uuid, bigint) from public, anon, authenticated;
grant execute on function public.adjust_storage_used(uuid, bigint) to service_role;
