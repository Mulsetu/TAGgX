-- RBAC catalog. `permissions` is a global, platform-defined list (not
-- tenant-scoped: every company chooses from the same catalog). `roles` are
-- per-company (each company gets its own Owner/Admin/Member/etc. rows,
-- seeded by the app when a company is created). `role_permissions` joins
-- the two and is tenant-scoped like any other per-company data.

create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique, -- e.g. 'assets.create', 'users.manage'
  description text,
  created_at timestamptz not null default now()
);

alter table public.permissions enable row level security;

create policy "permissions_read_all" on public.permissions
  for select
  to authenticated
  using (true);

create policy "permissions_super_admin_manage" on public.permissions
  for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  description text,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, name)
);

create index roles_company_id_idx on public.roles (company_id);

create trigger set_roles_updated_at
  before update on public.roles
  for each row execute function public.set_updated_at();

alter table public.roles enable row level security;

create policy "roles_tenant_isolation" on public.roles
  for all
  to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

create policy "roles_super_admin_bypass" on public.roles
  for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

create table public.role_permissions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  role_id uuid not null references public.roles (id) on delete cascade,
  permission_id uuid not null references public.permissions (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (role_id, permission_id)
);

create index role_permissions_company_id_idx on public.role_permissions (company_id);
create index role_permissions_role_id_idx on public.role_permissions (role_id);

alter table public.role_permissions enable row level security;

create policy "role_permissions_tenant_isolation" on public.role_permissions
  for all
  to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

create policy "role_permissions_super_admin_bypass" on public.role_permissions
  for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());
