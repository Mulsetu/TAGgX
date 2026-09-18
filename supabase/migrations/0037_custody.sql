-- Custody history and asset timeline. assets.allotted_to remains the live pointer.

create table public.asset_lifecycle_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  asset_id uuid not null references public.assets (id) on delete cascade,
  event_type text not null,
  summary text not null,
  payload jsonb not null default '{}'::jsonb,
  actor_id uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index asset_lifecycle_events_asset_idx on public.asset_lifecycle_events (asset_id, created_at desc);
create index asset_lifecycle_events_company_idx on public.asset_lifecycle_events (company_id);

alter table public.asset_lifecycle_events enable row level security;

create policy "asset_lifecycle_events_tenant_isolation" on public.asset_lifecycle_events
  for all to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

create policy "asset_lifecycle_events_super_admin_bypass" on public.asset_lifecycle_events
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

create table public.asset_handovers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  asset_id uuid not null references public.assets (id) on delete cascade,
  from_user_id uuid references public.users (id) on delete set null,
  to_user_id uuid not null references public.users (id) on delete restrict,
  handed_over_at date not null default current_date,
  accessories text,
  notes text,
  acknowledged_at timestamptz,
  acknowledged_by uuid references public.users (id) on delete set null,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index asset_handovers_asset_idx on public.asset_handovers (asset_id, created_at desc);

create table public.asset_returns (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  asset_id uuid not null references public.assets (id) on delete cascade,
  from_user_id uuid references public.users (id) on delete set null,
  returned_at date not null default current_date,
  condition_key text,
  damage_remarks text,
  missing_accessories text,
  inspection_result text,
  approved_by uuid references public.users (id) on delete set null,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index asset_returns_asset_idx on public.asset_returns (asset_id, created_at desc);

create table public.asset_transfers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  asset_id uuid not null references public.assets (id) on delete cascade,
  from_user_id uuid references public.users (id) on delete set null,
  to_user_id uuid references public.users (id) on delete set null,
  from_location_id uuid references public.locations (id) on delete set null,
  to_location_id uuid references public.locations (id) on delete set null,
  reason text,
  transferred_at date not null default current_date,
  acknowledged_at timestamptz,
  acknowledged_by uuid references public.users (id) on delete set null,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index asset_transfers_asset_idx on public.asset_transfers (asset_id, created_at desc);

alter table public.asset_handovers enable row level security;
alter table public.asset_returns enable row level security;
alter table public.asset_transfers enable row level security;

create policy "asset_handovers_tenant_isolation" on public.asset_handovers
  for all to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());
create policy "asset_handovers_super_admin_bypass" on public.asset_handovers
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy "asset_returns_tenant_isolation" on public.asset_returns
  for all to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());
create policy "asset_returns_super_admin_bypass" on public.asset_returns
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy "asset_transfers_tenant_isolation" on public.asset_transfers
  for all to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());
create policy "asset_transfers_super_admin_bypass" on public.asset_transfers
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());
