-- Reporting RPCs for the dashboard charts. All three are `security invoker`
-- (the default, made explicit here) so they run with the caller's own RLS
-- context — the existing tenant-isolation policies on assets/
-- maintenance_tickets already scope every result to the caller's company,
-- with no extra filtering needed in the function body.
--
-- Aggregating in SQL rather than fetching every row and counting in JS:
-- these are meant to work the same whether a company has 10 assets or
-- 100,000.

create or replace function public.get_asset_counts_by_category()
returns table (category_id uuid, category_name text, count bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select
    ac.id as category_id,
    coalesce(ac.name, 'Uncategorized') as category_name,
    count(a.id) as count
  from public.assets a
  left join public.asset_categories ac on ac.id = a.category_id
  group by ac.id, ac.name
  order by count desc;
$$;

grant execute on function public.get_asset_counts_by_category() to authenticated;

create or replace function public.get_asset_counts_by_status()
returns table (status text, count bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select a.status, count(a.id) as count
  from public.assets a
  group by a.status
  order by count desc;
$$;

grant execute on function public.get_asset_counts_by_status() to authenticated;

create or replace function public.get_open_maintenance_ticket_count()
returns bigint
language sql
stable
security invoker
set search_path = public
as $$
  select count(*) from public.maintenance_tickets
  where status in ('open', 'in_progress');
$$;

grant execute on function public.get_open_maintenance_ticket_count() to authenticated;
