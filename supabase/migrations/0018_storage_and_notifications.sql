-- Running per-company storage counter, kept in sync on every upload by
-- modules/storage/mutations.ts (via the adjust_storage_used RPC below) —
-- distinct from get_storage_usage_by_company's R2-aggregation, which is
-- still a Phase 8 stub. This counter is the real, currently-maintained
-- number; the R2 aggregation (once built) is meant to periodically
-- reconcile it in case of drift, not replace it.
alter table public.company_settings
  add column storage_used_bytes bigint not null default 0;

create or replace function public.adjust_storage_used(p_company_id uuid, p_delta bigint)
returns bigint
language sql
security invoker
set search_path = public
as $$
  insert into public.company_settings (company_id, storage_used_bytes)
  values (p_company_id, greatest(p_delta, 0))
  on conflict (company_id) do update
    set storage_used_bytes = greatest(company_settings.storage_used_bytes + p_delta, 0)
  returning storage_used_bytes;
$$;

grant execute on function public.adjust_storage_used(uuid, bigint) to authenticated;

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  type text not null,
  title text not null,
  message text not null,
  severity text not null default 'info'
    check (severity in ('info', 'warning', 'critical')),
  threshold_percent integer,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_company_id_idx on public.notifications (company_id);
create index notifications_company_type_created_idx
  on public.notifications (company_id, type, created_at desc);

alter table public.notifications enable row level security;

-- Tenant members can read (and, eventually, mark-as-read) their own
-- company's notifications, but never create or delete them directly —
-- every row here is system-generated (check_storage_thresholds() below,
-- and any future notification source), never a direct user action.
create policy "notifications_tenant_read" on public.notifications
  for select
  to authenticated
  using (company_id = public.current_company_id());

create policy "notifications_super_admin_bypass" on public.notifications
  for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- Compares every company's storage_used_bytes against
-- company_settings.storage_limit_bytes and inserts a notification when a
-- company crosses the 95% or 80% mark. `security definer` (unlike our
-- other helper functions): this runs as a background job over every
-- company, not scoped to one caller's own RLS context, by design.
--
-- Dedup: at most one notification per company per threshold per 24h, so
-- an hourly cron run doesn't spam the same warning while usage sits above
-- a threshold. >=95% takes priority over >=80% in a single run — a
-- company jumping straight to 95% doesn't also need the milder warning.
create or replace function public.check_storage_thresholds()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
  pct numeric;
begin
  for rec in
    select company_id, storage_used_bytes, storage_limit_bytes
    from public.company_settings
    where storage_limit_bytes > 0
  loop
    pct := (rec.storage_used_bytes::numeric / rec.storage_limit_bytes::numeric) * 100;

    if pct >= 95 then
      if not exists (
        select 1 from public.notifications
        where company_id = rec.company_id
          and type = 'storage_threshold'
          and threshold_percent = 95
          and created_at > now() - interval '24 hours'
      ) then
        insert into public.notifications (company_id, type, title, message, severity, threshold_percent)
        values (
          rec.company_id,
          'storage_threshold',
          'Storage almost full',
          format('Storage usage is at %s%% of your plan limit.', round(pct)),
          'critical',
          95
        );
      end if;
    elsif pct >= 80 then
      if not exists (
        select 1 from public.notifications
        where company_id = rec.company_id
          and type = 'storage_threshold'
          and threshold_percent = 80
          and created_at > now() - interval '24 hours'
      ) then
        insert into public.notifications (company_id, type, title, message, severity, threshold_percent)
        values (
          rec.company_id,
          'storage_threshold',
          'Storage usage high',
          format('Storage usage is at %s%% of your plan limit.', round(pct)),
          'warning',
          80
        );
      end if;
    end if;
  end loop;
end;
$$;

-- pg_cron ships as a Supabase-provided extension but isn't enabled by
-- default on every project — this will error until it's turned on
-- (Database > Extensions > pg_cron in the Supabase dashboard, or
-- `create extension pg_cron;` with sufficient privileges).
create extension if not exists pg_cron with schema extensions;

-- cron.schedule() upserts by job name, so re-running this migration
-- doesn't create duplicate jobs.
select cron.schedule(
  'check-storage-thresholds',
  '0 * * * *', -- hourly
  $$select public.check_storage_thresholds();$$
);
