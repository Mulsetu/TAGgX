-- Platform-level super admins (TagX staff), deliberately NOT part of the
-- tenant-scoped `users` table: a super admin does not belong to any one
-- company, so forcing a `company_id NOT NULL` onto them would be wrong.
--
-- This table, plus the two helper functions below, are what every later
-- RLS policy in this project is built on.

create table public.platform_admins (
  id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- SECURITY DEFINER + a pinned search_path: these functions run as the
-- (superuser) migration role, which bypasses RLS on the tables they touch.
-- That's what lets us call them from inside another table's own RLS policy
-- (e.g. `users`) without recursively re-triggering that policy.
-- See: https://supabase.com/docs/guides/database/postgres/row-level-security#call-a-security-definer-function

create or replace function public.is_super_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.platform_admins where id = auth.uid()
  );
$$;

grant execute on function public.is_super_admin() to authenticated;

-- References public.users, which doesn't exist until migration 0006.
-- Deliberately `plpgsql`, not `sql`: a `language sql` function is fully
-- parsed and analyzed at CREATE FUNCTION time (Postgres needs its result
-- type), so it would fail immediately with "relation does not exist".
-- `plpgsql` only checks syntax at creation and resolves the embedded
-- query's objects on first call, by which point every migration has run.
create or replace function public.current_company_id()
returns uuid
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  result uuid;
begin
  select company_id into result from public.users where id = auth.uid();
  return result;
end;
$$;

grant execute on function public.current_company_id() to authenticated;

alter table public.platform_admins enable row level security;

create policy "platform_admins_self_or_admin_read" on public.platform_admins
  for select
  to authenticated
  using (id = auth.uid() or public.is_super_admin());

-- No insert/update/delete policy for `authenticated`: granting platform
-- admin rights is an out-of-band operation (service_role / SQL console),
-- never something the app exposes to a logged-in user.
