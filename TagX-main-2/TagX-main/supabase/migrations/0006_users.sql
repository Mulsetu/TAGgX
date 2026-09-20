-- Tenant-scoped profile row for every company staff member, one-to-one
-- with an auth.users row. This is the table `current_company_id()` and
-- `src/lib/permissions` read from.

create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  role_id uuid not null references public.roles (id) on delete restrict,
  full_name text,
  email text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index users_company_id_idx on public.users (company_id);
create index users_role_id_idx on public.users (role_id);
create unique index users_email_key on public.users (lower(email));

create trigger set_users_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

alter table public.users enable row level security;

create policy "users_tenant_isolation" on public.users
  for all
  to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

create policy "users_super_admin_bypass" on public.users
  for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- No INSERT policy for `authenticated`: provisioning a user's tenant row
-- (and choosing their company_id/role_id) happens server-side, either via
-- a service-role client in modules/users/actions.ts or a SECURITY DEFINER
-- trigger on auth.users — never a client-supplied insert, since the client
-- must never be trusted to set its own company_id or role.
