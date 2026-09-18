-- Phase 1: feature modules, configurable conditions, category/status extras,
-- extra custom-field types, and Admin permission backfill.

alter table public.company_settings
  add column if not exists enabled_modules jsonb not null default '{
    "maintenance": true,
    "audits": true,
    "vendors": true,
    "handover": true,
    "preventive_maintenance": true,
    "reports": true
  }'::jsonb;

alter table public.asset_categories
  add column if not exists code_prefix text,
  add column if not exists is_active boolean not null default true,
  add column if not exists default_status_id uuid references public.asset_statuses (id) on delete set null,
  add column if not exists default_condition_key text;

alter table public.asset_statuses
  add column if not exists color text,
  add column if not exists is_final boolean not null default false,
  add column if not exists allows_assignment boolean not null default true;

update public.asset_statuses
set is_final = true, allows_assignment = false
where name in ('retired', 'disposed', 'lost');

alter table public.asset_statuses
  drop constraint if exists asset_statuses_color_format;
alter table public.asset_statuses
  add constraint asset_statuses_color_format
  check (color is null or color ~ '^#[0-9a-fA-F]{6}$');

-- Conditions catalog. assets.condition stays as a snapshot key (text) so
-- historical audits keep working; the CHECK enum is removed so orgs can add keys.
create table public.asset_conditions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  key text not null,
  name text not null,
  color text,
  sort_order integer not null default 0,
  is_system boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, key),
  constraint asset_conditions_key_format check (key ~ '^[a-z][a-z0-9_]{0,63}$'),
  constraint asset_conditions_color_format check (color is null or color ~ '^#[0-9a-fA-F]{6}$')
);

create index asset_conditions_company_id_idx on public.asset_conditions (company_id);

create trigger set_asset_conditions_updated_at
  before update on public.asset_conditions
  for each row execute function public.set_updated_at();

alter table public.asset_conditions enable row level security;

create policy "asset_conditions_tenant_isolation" on public.asset_conditions
  for all
  to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

create policy "asset_conditions_super_admin_bypass" on public.asset_conditions
  for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

insert into public.asset_conditions (company_id, key, name, sort_order, is_system)
select c.id, x.key, x.name, x.sort_order, true
from public.companies c
cross join (
  values
    ('new', 'New', 1),
    ('good', 'Good', 2),
    ('fair', 'Fair', 3),
    ('poor', 'Poor', 4)
) as x(key, name, sort_order);

alter table public.assets drop constraint if exists assets_condition_check;

alter table public.category_fields drop constraint if exists category_fields_type_allowed;
alter table public.category_fields
  add constraint category_fields_type_allowed
  check (field_type in ('text', 'number', 'date', 'select', 'checkbox', 'textarea', 'email', 'url', 'phone'));

-- Stamp system Admin roles with the expanded taxonomy.
update public.roles
set permissions = (
  select jsonb_object_agg(module, to_jsonb(array['view', 'create', 'edit', 'delete', 'assign', 'export']))
  from unnest(array[
    'assets', 'categories', 'locations', 'statuses', 'maintenance',
    'users', 'roles', 'audits', 'notifications', 'settings',
    'vendors', 'handover', 'reports'
  ]) as module
)
where is_system = true and name = 'Admin';

insert into public.reserved_slugs (slug) values
  ('vendors'),
  ('reports'),
  ('custody'),
  ('import'),
  ('activity')
on conflict (slug) do nothing;
