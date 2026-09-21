-- Closes a privilege-escalation gap the 0043 hardening pass didn't reach:
-- `users_tenant_isolation` and `roles_tenant_isolation` are both `FOR ALL`
-- with only a `company_id = current_company_id()` check. Column values
-- aren't restricted by RLS at all, so any authenticated tenant member
-- could previously call PostgREST directly (bypassing app code entirely)
-- and:
--   PATCH /rest/v1/users?id=eq.<self>     {"is_company_admin": true}
--   PATCH /rest/v1/roles?id=eq.<own role>  {"permissions": {...}}
--   DELETE /rest/v1/roles?id=eq.<system-role-id>
-- and grant themselves full tenant-admin access. Same column-level-grant
-- pattern as 0043: revoke broad write access, grant back only the columns
-- a member may set for themselves, and move every privilege-bearing
-- mutation behind a SECURITY DEFINER function that re-checks the caller's
-- own permission matrix server-side — so the app's requirePermission()
-- checks stop being the only thing standing between a tenant member and
-- full admin.

-- ---------------------------------------------------------------------------
-- Re-checks src/lib/permissions/has-permission.ts's hasPermission() at the
-- database layer: super admin bypasses, Company Admin bypasses, otherwise
-- look up the caller's own role and check its permission matrix. Used by
-- every RPC below so a direct REST call can't do anything the UI itself
-- wouldn't allow.
-- ---------------------------------------------------------------------------
create or replace function public.current_user_has_permission(p_module text, p_action text)
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  caller record;
  granted jsonb;
begin
  if public.is_super_admin() then
    return true;
  end if;

  select is_company_admin, role_id into caller
  from public.users
  where id = auth.uid();

  if caller.is_company_admin is true then
    return true;
  end if;

  if caller.role_id is null then
    return false;
  end if;

  select permissions -> p_module into granted
  from public.roles
  where id = caller.role_id;

  if granted is null then
    return false;
  end if;

  return granted ? p_action;
end;
$$;

revoke execute on function public.current_user_has_permission(text, text) from anon, public;
grant execute on function public.current_user_has_permission(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- users: lock down role_id / is_company_admin / is_active / company_id.
-- Split the old FOR ALL policy so DELETE isn't implicitly allowed by a
-- tenant-scoped USING clause with no matching app path.
-- ---------------------------------------------------------------------------
drop policy if exists "users_tenant_isolation" on public.users;

create policy "users_tenant_select" on public.users
  for select
  to authenticated
  using (company_id = public.current_company_id());

-- No UPDATE/INSERT/DELETE USING/WITH CHECK policy for `authenticated`:
-- every write to a privileged column goes through the RPCs below (which
-- run as the migration role and bypass RLS by design). Column grants
-- still gate which columns can be touched at all.

revoke insert, update, delete on public.users from anon, authenticated;
grant select on public.users to authenticated;

create or replace function public.set_user_active(p_user_id uuid, p_is_active boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_company uuid;
begin
  if not public.current_user_has_permission('users', 'edit') then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select company_id into target_company from public.users where id = p_user_id;
  if target_company is null or target_company is distinct from public.current_company_id() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  update public.users set is_active = p_is_active where id = p_user_id;
end;
$$;

create or replace function public.update_user_role(p_user_id uuid, p_role_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_company uuid;
  role_company uuid;
begin
  if not public.current_user_has_permission('users', 'edit') then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select company_id into target_company from public.users where id = p_user_id;
  select company_id into role_company from public.roles where id = p_role_id;

  if target_company is null or target_company is distinct from public.current_company_id() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if role_company is null or role_company is distinct from public.current_company_id() then
    raise exception 'role not found' using errcode = '42501';
  end if;

  update public.users set role_id = p_role_id where id = p_user_id;
end;
$$;

-- Deliberately its own check, not current_user_has_permission('users', ...):
-- granting Company Admin is a Company-Admin-or-super-admin-only action in
-- the app (src/modules/users/actions.ts's setCompanyAdminAction), not
-- gated by the users.edit permission cell.
create or replace function public.set_company_admin(p_user_id uuid, p_is_company_admin boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_company uuid;
  caller_is_admin boolean;
begin
  select is_company_admin into caller_is_admin from public.users where id = auth.uid();
  if not (coalesce(caller_is_admin, false) or public.is_super_admin()) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select company_id into target_company from public.users where id = p_user_id;
  if target_company is null or target_company is distinct from public.current_company_id() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  update public.users set is_company_admin = p_is_company_admin where id = p_user_id;
end;
$$;

revoke execute on function public.set_user_active(uuid, boolean) from anon, public;
revoke execute on function public.update_user_role(uuid, uuid) from anon, public;
revoke execute on function public.set_company_admin(uuid, boolean) from anon, public;
grant execute on function public.set_user_active(uuid, boolean) to authenticated;
grant execute on function public.update_user_role(uuid, uuid) to authenticated;
grant execute on function public.set_company_admin(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- roles: lock down permissions / is_system. Split FOR ALL so the seeded
-- Company Admin role (is_system = true) can't be edited or deleted by a
-- direct REST call, only by app code taking the RLS-checked path.
-- ---------------------------------------------------------------------------
drop policy if exists "roles_tenant_isolation" on public.roles;

create policy "roles_tenant_select" on public.roles
  for select
  to authenticated
  using (company_id = public.current_company_id());

create policy "roles_tenant_insert" on public.roles
  for insert
  to authenticated
  with check (company_id = public.current_company_id());

create policy "roles_tenant_update" on public.roles
  for update
  to authenticated
  using (company_id = public.current_company_id() and is_system = false)
  with check (company_id = public.current_company_id() and is_system = false);

create policy "roles_tenant_delete" on public.roles
  for delete
  to authenticated
  using (company_id = public.current_company_id() and is_system = false);

revoke insert, update, delete on public.roles from anon, authenticated;
grant select on public.roles to authenticated;
grant insert (company_id, name, description) on public.roles to authenticated;
grant update (name, description) on public.roles to authenticated;
grant delete on public.roles to authenticated;

create or replace function public.update_role_permissions(p_role_id uuid, p_permissions jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  role_company uuid;
  role_is_system boolean;
begin
  if not public.current_user_has_permission('roles', 'edit') then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select company_id, is_system into role_company, role_is_system
  from public.roles
  where id = p_role_id;

  if role_company is null or role_company is distinct from public.current_company_id() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if role_is_system then
    raise exception 'the Company Admin role cannot be changed' using errcode = '42501';
  end if;

  update public.roles set permissions = p_permissions where id = p_role_id;
end;
$$;

revoke execute on function public.update_role_permissions(uuid, jsonb) from anon, public;
grant execute on function public.update_role_permissions(uuid, jsonb) to authenticated;

-- modules/roles/mutations.ts's duplicateRole() copies a source role's
-- `permissions` onto a new row — an insert column grant covering
-- `permissions` would let anyone POST a role with any permissions they
-- like, so that copy happens here instead, where the source role's
-- company (and roles.create permission) are checked first.
create or replace function public.duplicate_role(p_source_role_id uuid, p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  source record;
  new_id uuid;
begin
  if not public.current_user_has_permission('roles', 'create') then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select company_id, description, permissions into source
  from public.roles
  where id = p_source_role_id;

  if source.company_id is null or source.company_id is distinct from public.current_company_id() then
    raise exception 'role not found' using errcode = '42501';
  end if;

  insert into public.roles (company_id, name, description, permissions)
  values (public.current_company_id(), p_name, source.description, coalesce(source.permissions, '{}'::jsonb))
  returning id into new_id;

  return new_id;
end;
$$;

revoke execute on function public.duplicate_role(uuid, text) from anon, public;
grant execute on function public.duplicate_role(uuid, text) to authenticated;

-- createSystemAdminRole / seedDefaultCompanyRoles already run on the
-- service-role (admin) client at company-creation time — that client
-- bypasses RLS and column grants entirely, so seeding is unaffected by
-- the narrower `authenticated` grants above.
