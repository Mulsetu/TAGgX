-- Field groupings (Basic / Additional / Purchase Info) mirror
-- /docs/asset-fields.md — keep both in sync when this table changes.

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,

  -- Basic Info
  name text not null,
  asset_code text not null,
  category_id uuid references public.asset_categories (id) on delete set null,
  location_id uuid references public.locations (id) on delete set null,
  status text not null default 'active'
    check (status in ('active', 'in_repair', 'retired', 'disposed', 'lost')),
  description text,

  -- Additional Info
  serial_number text,
  model text,
  manufacturer text,
  condition text
    check (condition in ('new', 'good', 'fair', 'poor')),
  assigned_to uuid references public.users (id) on delete set null,
  notes text,
  custom_fields jsonb not null default '{}'::jsonb,

  -- Purchase Info
  vendor text,
  purchase_date date,
  purchase_price numeric(12, 2),
  currency text not null default 'USD',
  warranty_expiry date,
  depreciation_method text
    check (depreciation_method in ('straight_line', 'declining_balance', 'none')),
  useful_life_months integer,
  salvage_value numeric(12, 2),

  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (company_id, asset_code)
);

create index assets_company_id_idx on public.assets (company_id);
create index assets_status_idx on public.assets (status);
create index assets_category_id_idx on public.assets (category_id);
create index assets_location_id_idx on public.assets (location_id);

create trigger set_assets_updated_at
  before update on public.assets
  for each row execute function public.set_updated_at();

alter table public.assets enable row level security;

create policy "assets_tenant_isolation" on public.assets
  for all
  to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

create policy "assets_super_admin_bypass" on public.assets
  for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());
