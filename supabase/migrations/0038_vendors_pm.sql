-- Vendors, vendor-scoped users, and preventive maintenance.

create table public.vendors (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  company_name text,
  contact_name text,
  email text,
  phone text,
  address text,
  service_category text,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, name)
);

create index vendors_company_id_idx on public.vendors (company_id);

create trigger set_vendors_updated_at
  before update on public.vendors
  for each row execute function public.set_updated_at();

alter table public.vendors enable row level security;

create policy "vendors_tenant_isolation" on public.vendors
  for all to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

create policy "vendors_super_admin_bypass" on public.vendors
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

alter table public.users
  add column if not exists vendor_id uuid references public.vendors (id) on delete set null;

create index if not exists users_vendor_id_idx on public.users (vendor_id);

alter table public.company_invites
  add column if not exists vendor_id uuid references public.vendors (id) on delete set null;

alter table public.assets
  add column if not exists vendor_id uuid references public.vendors (id) on delete set null;

create table public.maintenance_types (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  key text not null,
  name text not null,
  is_system boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  unique (company_id, key)
);

alter table public.maintenance_types enable row level security;
create policy "maintenance_types_tenant_isolation" on public.maintenance_types
  for all to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());
create policy "maintenance_types_super_admin_bypass" on public.maintenance_types
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

insert into public.maintenance_types (company_id, key, name, is_system, sort_order)
select c.id, x.key, x.name, true, x.sort_order
from public.companies c
cross join (
  values
    ('corrective', 'Corrective', 1),
    ('preventive', 'Preventive', 2),
    ('inspection', 'Inspection', 3),
    ('calibration', 'Calibration', 4),
    ('amc', 'AMC service', 5),
    ('warranty', 'Warranty service', 6),
    ('emergency', 'Emergency', 7)
) as x(key, name, sort_order);

alter table public.maintenance_tickets
  add column if not exists vendor_id uuid references public.vendors (id) on delete set null,
  add column if not exists priority text not null default 'normal',
  add column if not exists due_at date,
  add column if not exists type_key text not null default 'corrective',
  add column if not exists plan_id uuid;

alter table public.maintenance_tickets
  drop constraint if exists maintenance_tickets_priority_allowed;
alter table public.maintenance_tickets
  add constraint maintenance_tickets_priority_allowed
  check (priority in ('low', 'normal', 'high', 'emergency'));

create table public.maintenance_plans (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  asset_id uuid not null references public.assets (id) on delete cascade,
  name text not null,
  type_key text not null default 'preventive',
  frequency text not null,
  interval_days integer,
  next_due_at date not null,
  last_completed_at date,
  assigned_to uuid references public.users (id) on delete set null,
  vendor_id uuid references public.vendors (id) on delete set null,
  checklist text,
  estimated_cost numeric,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint maintenance_plans_frequency_allowed
    check (frequency in ('daily', 'weekly', 'monthly', 'quarterly', 'half_yearly', 'yearly', 'custom'))
);

create index maintenance_plans_due_idx on public.maintenance_plans (company_id, next_due_at) where is_active;

create trigger set_maintenance_plans_updated_at
  before update on public.maintenance_plans
  for each row execute function public.set_updated_at();

alter table public.maintenance_plans enable row level security;
create policy "maintenance_plans_tenant_isolation" on public.maintenance_plans
  for all to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());
create policy "maintenance_plans_super_admin_bypass" on public.maintenance_plans
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

alter table public.maintenance_tickets
  add constraint maintenance_tickets_plan_fk
  foreign key (plan_id) references public.maintenance_plans (id) on delete set null;

create or replace function public.current_vendor_id()
returns uuid
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  result uuid;
begin
  select vendor_id into result from public.users where id = auth.uid();
  return result;
end;
$$;

grant execute on function public.current_vendor_id() to authenticated;

drop policy if exists "maintenance_tickets_tenant_isolation" on public.maintenance_tickets;
create policy "maintenance_tickets_tenant_isolation" on public.maintenance_tickets
  for all to authenticated
  using (
    company_id = public.current_company_id()
    and (public.current_vendor_id() is null or vendor_id = public.current_vendor_id())
  )
  with check (
    company_id = public.current_company_id()
    and (public.current_vendor_id() is null or vendor_id = public.current_vendor_id())
  );

drop policy if exists "assets_tenant_isolation" on public.assets;
create policy "assets_tenant_isolation" on public.assets
  for all to authenticated
  using (
    company_id = public.current_company_id()
    and (
      public.current_vendor_id() is null
      or vendor_id = public.current_vendor_id()
      or id in (
        select asset_id from public.maintenance_tickets
        where vendor_id = public.current_vendor_id()
      )
    )
  )
  with check (
    company_id = public.current_company_id()
    and public.current_vendor_id() is null
  );

insert into public.roles (company_id, name, description, is_system, permissions)
select
  c.id,
  'Vendor',
  'Limited access to assigned maintenance tickets.',
  true,
  jsonb_build_object(
    'maintenance', jsonb_build_array('view', 'edit'),
    'assets', jsonb_build_array('view')
  )
from public.companies c
where not exists (
  select 1 from public.roles r where r.company_id = c.id and r.name = 'Vendor' and r.is_system = true
);
