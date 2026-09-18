-- One settings row per company. company_id is both the primary key and the
-- tenant-scope column, so the PK index already covers the "index on
-- company_id" requirement — no separate index needed.

create table public.company_settings (
  company_id uuid primary key references public.companies (id) on delete cascade,
  storage_limit_bytes bigint not null default 5368709120, -- 5 GiB
  asset_code_format text not null default 'AST-{SEQ:05d}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_company_settings_updated_at
  before update on public.company_settings
  for each row execute function public.set_updated_at();

alter table public.company_settings enable row level security;

create policy "company_settings_tenant_isolation" on public.company_settings
  for all
  to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

create policy "company_settings_super_admin_bypass" on public.company_settings
  for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());
