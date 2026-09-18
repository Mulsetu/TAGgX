-- Column-level grants so PostgREST cannot update privileged fields
-- even when a tenant JWT is valid. Service role (admin client) is unchanged.

-- companies: members may read their row and edit branding fields only.
drop policy if exists "companies_tenant_isolation" on public.companies;

create policy "companies_tenant_select" on public.companies
  for select
  to authenticated
  using (id = public.current_company_id());

create policy "companies_tenant_update" on public.companies
  for update
  to authenticated
  using (id = public.current_company_id())
  with check (id = public.current_company_id());

revoke insert, update, delete on public.companies from anon, authenticated;
grant select on public.companies to authenticated;
grant update (name, logo_url, primary_color, secondary_color) on public.companies to authenticated;

-- company_settings: members may read, and write format / module flags only.
drop policy if exists "company_settings_tenant_isolation" on public.company_settings;

create policy "company_settings_tenant_select" on public.company_settings
  for select
  to authenticated
  using (company_id = public.current_company_id());

create policy "company_settings_tenant_insert" on public.company_settings
  for insert
  to authenticated
  with check (company_id = public.current_company_id());

create policy "company_settings_tenant_update" on public.company_settings
  for update
  to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

revoke insert, update, delete on public.company_settings from anon, authenticated;
grant select on public.company_settings to authenticated;
grant insert (company_id, asset_code_format, enabled_modules) on public.company_settings to authenticated;
grant update (asset_code_format, enabled_modules) on public.company_settings to authenticated;

-- Sequence + storage counters run as definer so they can touch columns
-- authenticated can no longer UPDATE, and they refuse a foreign company_id.
create or replace function public.increment_asset_sequence(p_company_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  seq integer;
begin
  if p_company_id is distinct from public.current_company_id()
     and not public.is_super_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  insert into public.company_settings (company_id, next_asset_sequence)
  values (p_company_id, 2)
  on conflict (company_id)
  do update set next_asset_sequence = company_settings.next_asset_sequence + 1
  returning next_asset_sequence - 1 into seq;

  return seq;
end;
$$;

create or replace function public.adjust_storage_used(p_company_id uuid, p_delta bigint)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  used bigint;
begin
  if p_company_id is distinct from public.current_company_id()
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

revoke execute on function public.increment_asset_sequence(uuid) from anon, public;
revoke execute on function public.adjust_storage_used(uuid, bigint) from anon, public;
grant execute on function public.increment_asset_sequence(uuid) to authenticated;
grant execute on function public.adjust_storage_used(uuid, bigint) to authenticated;

-- Persist template vars so cron retries send the original email body.
alter table public.notification_logs
  add column if not exists template_vars jsonb;
