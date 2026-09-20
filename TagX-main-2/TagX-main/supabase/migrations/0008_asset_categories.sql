create table public.asset_categories (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  parent_category_id uuid references public.asset_categories (id) on delete set null,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, name)
);

create index asset_categories_company_id_idx on public.asset_categories (company_id);
create index asset_categories_parent_category_id_idx on public.asset_categories (parent_category_id);

create trigger set_asset_categories_updated_at
  before update on public.asset_categories
  for each row execute function public.set_updated_at();

alter table public.asset_categories enable row level security;

create policy "asset_categories_tenant_isolation" on public.asset_categories
  for all
  to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

create policy "asset_categories_super_admin_bypass" on public.asset_categories
  for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());
