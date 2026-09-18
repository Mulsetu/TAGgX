-- Hierarchical locations: Company (tenant) → Site → Building → Floor → Room/Zone.
-- Existing rows are classified by current parent depth.

alter table public.locations
  add column if not exists kind text not null default 'site';

alter table public.locations
  drop constraint if exists locations_kind_allowed;

alter table public.locations
  add constraint locations_kind_allowed
  check (kind in ('site', 'building', 'floor', 'room'));

alter table public.locations
  drop constraint if exists locations_company_id_name_key;

create unique index if not exists locations_company_site_name_idx
  on public.locations (company_id, name)
  where parent_location_id is null;

create unique index if not exists locations_company_parent_name_idx
  on public.locations (company_id, parent_location_id, name)
  where parent_location_id is not null;

with recursive tree as (
  select id, 0 as depth
  from public.locations
  where parent_location_id is null
  union all
  select loc.id, tree.depth + 1
  from public.locations loc
  inner join tree on loc.parent_location_id = tree.id
)
update public.locations loc
set kind = case
  when tree.depth = 0 then 'site'
  when tree.depth = 1 then 'building'
  when tree.depth = 2 then 'floor'
  else 'room'
end
from tree
where loc.id = tree.id;

-- Snapshotted moves so history survives rename/delete of a location.
create table public.asset_location_history (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  asset_id uuid not null references public.assets (id) on delete cascade,
  from_location_id uuid,
  to_location_id uuid,
  from_location_path text,
  to_location_path text,
  moved_by uuid,
  notes text,
  moved_at timestamptz not null default now(),
  constraint asset_location_history_moved_by_fkey
    foreign key (moved_by) references public.users (id) on delete set null
);

create index asset_location_history_asset_id_idx
  on public.asset_location_history (asset_id, moved_at desc);
create index asset_location_history_company_id_idx
  on public.asset_location_history (company_id);

alter table public.asset_location_history enable row level security;

create policy "asset_location_history_tenant_isolation" on public.asset_location_history
  for all
  to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

create policy "asset_location_history_super_admin_bypass" on public.asset_location_history
  for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());
