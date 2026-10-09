-- A Company Admin's role is fixed: nobody (another admin, anyone holding
-- users.edit, or a direct REST/RPC call) can move them to another role.
-- The built-in "Company Admin" role (is_system, name 'Company Admin') is
-- also not assignable from the role dropdown — the only way in is
-- set_company_admin(), which now puts the user on that role too so the
-- label always matches the access.

create or replace function public.update_user_role(p_user_id uuid, p_role_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_company uuid;
  target_is_admin boolean;
  role_company uuid;
  role_is_admin_role boolean;
begin
  if not public.current_user_has_permission('users', 'edit') then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select company_id, is_company_admin into target_company, target_is_admin
  from public.users where id = p_user_id;
  select company_id, (is_system and name = 'Company Admin') into role_company, role_is_admin_role
  from public.roles where id = p_role_id;

  if target_company is null or target_company is distinct from public.current_company_id() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if role_company is null or role_company is distinct from public.current_company_id() then
    raise exception 'role not found' using errcode = '42501';
  end if;
  if coalesce(target_is_admin, false) then
    raise exception 'company admin role is fixed' using errcode = 'P0001';
  end if;
  if coalesce(role_is_admin_role, false) then
    raise exception 'use set_company_admin to grant company admin' using errcode = 'P0001';
  end if;

  update public.users set role_id = p_role_id where id = p_user_id;
end;
$$;

create or replace function public.set_company_admin(p_user_id uuid, p_is_company_admin boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_company uuid;
  caller_is_admin boolean;
  admin_role uuid;
begin
  select is_company_admin into caller_is_admin from public.users where id = auth.uid();
  if not (coalesce(caller_is_admin, false) or public.is_super_admin()) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select company_id into target_company from public.users where id = p_user_id;
  if target_company is null or target_company is distinct from public.current_company_id() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  -- Granting is one-way (revoking is refused in the app), and the role
  -- follows the flag so a Company Admin never shows as "Viewer".
  select id into admin_role from public.roles
  where company_id = target_company and is_system and name = 'Company Admin'
  limit 1;

  update public.users
  set is_company_admin = p_is_company_admin,
      role_id = case when p_is_company_admin and admin_role is not null then admin_role else role_id end
  where id = p_user_id;
end;
$$;

revoke execute on function public.update_user_role(uuid, uuid) from anon, public;
revoke execute on function public.set_company_admin(uuid, boolean) from anon, public;
grant execute on function public.update_user_role(uuid, uuid) to authenticated;
grant execute on function public.set_company_admin(uuid, boolean) to authenticated;
