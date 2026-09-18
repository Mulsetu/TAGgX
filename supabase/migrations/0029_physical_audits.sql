-- Physical inventory audits (campaigns), distinct from public.audit_log
-- which remains the append-only activity trail.
create table public.audits (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  scheduled_date date not null,
  location_id uuid references public.locations (id) on delete set null,
  location_name text,
  status text not null default 'draft',
  created_by uuid references public.users (id) on delete set null,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint audits_name_len check (char_length(name) between 1 and 200),
  constraint audits_status_allowed check (status in ('draft', 'active', 'completed'))
);

create index audits_company_id_idx on public.audits (company_id);
create index audits_status_idx on public.audits (company_id, status);

create trigger set_audits_updated_at
  before update on public.audits
  for each row execute function public.set_updated_at();

alter table public.audits enable row level security;

create policy "audits_tenant_isolation" on public.audits
  for all
  to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

create policy "audits_super_admin_bypass" on public.audits
  for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- One row per in-scope asset, snapshotted at campaign creation so a
-- completed audit still shows the expected location/condition even if
-- the live asset moves later.
create table public.audit_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  audit_id uuid not null references public.audits (id) on delete cascade,
  asset_id uuid not null references public.assets (id) on delete cascade,
  asset_name text not null,
  asset_code text not null,
  expected_location_id uuid,
  expected_location_name text,
  expected_condition text,
  status text not null default 'unverified',
  exception_types text[] not null default '{}',
  found_location_id uuid references public.locations (id) on delete set null,
  found_location_name text,
  found_condition text,
  notes text,
  scanned_at timestamptz,
  scanned_by uuid references public.users (id) on delete set null,
  resolved boolean not null default false,
  resolved_at timestamptz,
  resolved_by uuid references public.users (id) on delete set null,
  resolution_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (audit_id, asset_id),
  constraint audit_items_status_allowed check (status in ('unverified', 'verified', 'exception')),
  constraint audit_items_exception_when_needed check (
    (status = 'exception' and cardinality(exception_types) > 0)
    or (status <> 'exception' and cardinality(exception_types) = 0)
  )
);

create index audit_items_audit_id_idx on public.audit_items (audit_id);
create index audit_items_company_id_idx on public.audit_items (company_id);
create index audit_items_asset_id_idx on public.audit_items (asset_id);
create index audit_items_status_idx on public.audit_items (audit_id, status);

create trigger set_audit_items_updated_at
  before update on public.audit_items
  for each row execute function public.set_updated_at();

alter table public.audit_items enable row level security;

create policy "audit_items_tenant_isolation" on public.audit_items
  for all
  to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

create policy "audit_items_super_admin_bypass" on public.audit_items
  for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());
