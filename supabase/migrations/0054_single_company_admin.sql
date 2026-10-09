-- Exactly one Company Admin per company. Making someone else Company
-- Admin is now a *transfer*: the new person gets the flag (and the
-- built-in Company Admin role) and the previous admin is moved to a
-- normal role in the same step.

-- 1. Clean up companies that already have more than one admin: keep the
--    earliest one, move the rest to the company's "Manager" role (falling
--    back to "Viewer", then any other non-system role).
with ranked as (
  select id, company_id,
         row_number() over (partition by company_id order by created_at, id) as rn
  from public.users
  where is_company_admin
),
fallback_role as (
  select distinct on (r.company_id) r.company_id, r.id as role_id
  from public.roles r
  where not r.is_system
  order by r.company_id,
           case r.name when 'Manager' then 0 when 'Viewer' then 1 else 2 end,
           r.created_at
)
update public.users u
set is_company_admin = false,
    role_id = coalesce(f.role_id, u.role_id)
from ranked
left join fallback_role f on f.company_id = ranked.company_id
where u.id = ranked.id and ranked.rn > 1;

-- 2. Enforce it.
create unique index if not exists users_one_company_admin_per_company
  on public.users (company_id)
  where is_company_admin;

-- 3. Transfer. Caller must be the current Company Admin (or a super
--    admin). p_previous_role is what the outgoing admin becomes; it must be
--    a normal role of the same company.
create or replace function public.transfer_company_admin(p_new_admin uuid, p_previous_role uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_is_admin boolean;
  target_company uuid;
  target_is_admin boolean;
  role_company uuid;
  role_is_system boolean;
  admin_role uuid;
begin
  select is_company_admin into caller_is_admin from public.users where id = auth.uid();
  if not (coalesce(caller_is_admin, false) or public.is_super_admin()) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select company_id, is_company_admin into target_company, target_is_admin
  from public.users where id = p_new_admin;
  if target_company is null or target_company is distinct from public.current_company_id() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if coalesce(target_is_admin, false) then
    raise exception 'already company admin' using errcode = 'P0001';
  end if;

  select company_id, is_system into role_company, role_is_system
  from public.roles where id = p_previous_role;
  if role_company is distinct from target_company or coalesce(role_is_system, true) then
    raise exception 'choose a normal role for the previous admin' using errcode = 'P0001';
  end if;

  select id into admin_role from public.roles
  where company_id = target_company and is_system and name = 'Company Admin'
  limit 1;

  -- Demote first so the one-admin index is never violated mid-transfer.
  update public.users
  set is_company_admin = false, role_id = p_previous_role
  where company_id = target_company and is_company_admin;

  update public.users
  set is_company_admin = true, role_id = coalesce(admin_role, role_id)
  where id = p_new_admin;
end;
$$;

revoke execute on function public.transfer_company_admin(uuid, uuid) from anon, public;
grant execute on function public.transfer_company_admin(uuid, uuid) to authenticated;

-- 4. The old one-way grant is superseded by the transfer.
drop function if exists public.set_company_admin(uuid, boolean);
