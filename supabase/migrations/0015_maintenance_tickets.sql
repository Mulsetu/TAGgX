create table public.maintenance_tickets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  asset_id uuid not null references public.assets (id) on delete cascade,
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'resolved', 'cancelled')),
  title text not null,
  description text,
  reported_by uuid references public.users (id) on delete set null,
  assigned_to uuid references public.users (id) on delete set null,
  opened_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index maintenance_tickets_company_id_idx on public.maintenance_tickets (company_id);
create index maintenance_tickets_status_idx on public.maintenance_tickets (status);
create index maintenance_tickets_asset_id_idx on public.maintenance_tickets (asset_id);

create trigger set_maintenance_tickets_updated_at
  before update on public.maintenance_tickets
  for each row execute function public.set_updated_at();

alter table public.maintenance_tickets enable row level security;

create policy "maintenance_tickets_tenant_isolation" on public.maintenance_tickets
  for all
  to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

create policy "maintenance_tickets_super_admin_bypass" on public.maintenance_tickets
  for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());
