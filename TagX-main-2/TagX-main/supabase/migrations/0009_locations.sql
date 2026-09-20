create table public.locations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  parent_location_id uuid references public.locations (id) on delete set null,
  name text not null,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  postal_code text,
  country text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, name)
);

create index locations_company_id_idx on public.locations (company_id);
create index locations_parent_location_id_idx on public.locations (parent_location_id);

create trigger set_locations_updated_at
  before update on public.locations
  for each row execute function public.set_updated_at();

alter table public.locations enable row level security;

create policy "locations_tenant_isolation" on public.locations
  for all
  to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

create policy "locations_super_admin_bypass" on public.locations
  for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());
