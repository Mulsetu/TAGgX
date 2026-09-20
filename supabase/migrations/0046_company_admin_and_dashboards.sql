-- Company Admin is a user flag, independent of the role permission matrix.
-- Default Auditor / Technician / Viewer roles. Role-specific dashboard layouts.
-- Location chart RPC. Idempotent.

-- ---------------------------------------------------------------------------
-- Company administrator flag
-- ---------------------------------------------------------------------------
alter table public.users
  add column if not exists is_company_admin boolean not null default false;

create index if not exists users_company_admin_idx
  on public.users (company_id)
  where is_company_admin = true;

comment on column public.users.is_company_admin is
  'Full company workspace access. Bypasses the assigned role matrix. Still respects plan modules and company-enabled modules.';

update public.users u
set is_company_admin = true
from public.roles r
where u.role_id = r.id
  and r.is_system = true
  and r.name in ('Admin', 'Company Admin')
  and u.is_company_admin = false;

update public.roles
set
  name = 'Company Admin',
  description = 'Full company administrator. Product access does not depend on this permission matrix.'
where is_system = true
  and name = 'Admin';

-- ---------------------------------------------------------------------------
-- Dashboard layouts per role (company default stays on dashboard_widgets)
-- ---------------------------------------------------------------------------
alter table public.company_settings
  add column if not exists dashboard_layouts jsonb not null default '{}'::jsonb;

comment on column public.company_settings.dashboard_layouts is
  'Optional per-role widget layouts: { "roles": { "<roleId>": { widgetKey: { enabled, order, size } } } }.';

grant update (dashboard_layouts) on public.company_settings to authenticated;

-- ---------------------------------------------------------------------------
-- Default operational roles for existing companies
-- ---------------------------------------------------------------------------
insert into public.roles (company_id, name, description, is_system, permissions)
select
  c.id,
  'Auditor',
  'Physical audits and floor scanning.',
  false,
  '{
    "assets": ["view", "export"],
    "audits": ["view", "create", "edit", "export", "approve"],
    "locations": ["view"],
    "categories": ["view"],
    "statuses": ["view"],
    "reports": ["view", "export"],
    "handover": ["view"]
  }'::jsonb
from public.companies c
where not exists (
  select 1 from public.roles r where r.company_id = c.id and r.name = 'Auditor'
);

insert into public.roles (company_id, name, description, is_system, permissions)
select
  c.id,
  'Technician',
  'Maintenance tickets and assigned assets.',
  false,
  '{
    "assets": ["view", "edit", "assign"],
    "maintenance": ["view", "create", "edit", "assign", "resolve"],
    "locations": ["view"],
    "statuses": ["view"],
    "vendors": ["view"]
  }'::jsonb
from public.companies c
where not exists (
  select 1 from public.roles r where r.company_id = c.id and r.name = 'Technician'
);

insert into public.roles (company_id, name, description, is_system, permissions)
select
  c.id,
  'Viewer',
  'Read-only asset and report access.',
  false,
  '{
    "assets": ["view"],
    "locations": ["view"],
    "categories": ["view"],
    "statuses": ["view"],
    "reports": ["view"]
  }'::jsonb
from public.companies c
where not exists (
  select 1 from public.roles r where r.company_id = c.id and r.name = 'Viewer'
);

-- ---------------------------------------------------------------------------
-- Assets by location (security invoker — RLS still applies)
-- ---------------------------------------------------------------------------
create or replace function public.get_asset_counts_by_location()
returns table (location_id uuid, location_name text, count bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select
    loc.id as location_id,
    coalesce(loc.name, 'No location') as location_name,
    count(a.id) as count
  from public.assets a
  left join public.locations loc on loc.id = a.location_id
  where a.deleted_at is null
  group by loc.id, loc.name
  order by count desc;
$$;

grant execute on function public.get_asset_counts_by_location() to authenticated;
