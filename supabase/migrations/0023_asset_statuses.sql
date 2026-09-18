-- Makes asset status a fully configurable, per-company list (like
-- asset_categories/locations) instead of a fixed CHECK-constrained enum.
-- Every existing company gets the same 5 statuses the app used to hard-code
-- (is_system = true, just a UI hint — nothing stops editing or deleting
-- them beyond the FK below). New companies get the same set seeded by
-- modules/statuses/mutations.ts's seedDefaultAssetStatuses(), called
-- alongside createSystemAdminRole() at company-creation time.

create table public.asset_statuses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, name)
);

create index asset_statuses_company_id_idx on public.asset_statuses (company_id);

create trigger set_asset_statuses_updated_at
  before update on public.asset_statuses
  for each row execute function public.set_updated_at();

alter table public.asset_statuses enable row level security;

create policy "asset_statuses_tenant_isolation" on public.asset_statuses
  for all
  to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

create policy "asset_statuses_super_admin_bypass" on public.asset_statuses
  for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- Seed every existing company with the 5 statuses the app used to hard-code.
insert into public.asset_statuses (company_id, name, sort_order, is_system)
select c.id, s.name, s.sort_order, true
from public.companies c
cross join (
  values ('active', 1), ('in_repair', 2), ('retired', 3), ('disposed', 4), ('lost', 5)
) as s(name, sort_order);

alter table public.assets add column status_id uuid references public.asset_statuses (id) on delete restrict;

update public.assets a
set status_id = s.id
from public.asset_statuses s
where s.company_id = a.company_id and s.name = a.status;

-- No production asset data exists yet at this stage of the build (verified
-- via a read-only count before writing this migration) — safe to make this
-- NOT NULL immediately rather than leaving it nullable "just in case".
alter table public.assets alter column status_id set not null;

alter table public.assets drop column status;

create index assets_status_id_idx on public.assets (status_id);

-- get_asset_counts_by_status() (0016_dashboard_aggregates.sql) grouped by
-- the old fixed-enum status text column — repoint it at the new
-- per-company asset_statuses table now that status is configurable.
-- Return type (OUT params) is changing, so create or replace can't be
-- used as-is; drop the old signature first.
drop function if exists public.get_asset_counts_by_status();

create function public.get_asset_counts_by_status()
returns table (status_id uuid, status_name text, count bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select
    s.id as status_id,
    s.name as status_name,
    count(a.id) as count
  from public.asset_statuses s
  left join public.assets a on a.status_id = s.id
  group by s.id, s.name, s.sort_order
  order by s.sort_order;
$$;

grant execute on function public.get_asset_counts_by_status() to authenticated;
