-- Product enhancements: asset data, transfer acknowledgement, PM instructions,
-- audit extras, branded-email contact fields, QR event log.
-- Idempotent. Does not delete production data.

-- ---------------------------------------------------------------------------
-- Company contact details (tenant-branded emails)
-- ---------------------------------------------------------------------------
alter table public.companies
  add column if not exists contact_email text,
  add column if not exists contact_phone text,
  add column if not exists contact_address text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'companies_contact_email_len'
  ) then
    alter table public.companies
      add constraint companies_contact_email_len
      check (contact_email is null or char_length(contact_email) between 3 and 320);
  end if;
end $$;

grant update (name, logo_url, primary_color, secondary_color, contact_email, contact_phone, contact_address)
  on public.companies to authenticated;

-- ---------------------------------------------------------------------------
-- Asset data fields
-- ---------------------------------------------------------------------------
alter table public.assets
  add column if not exists criticality text,
  add column if not exists useful_life_years integer,
  add column if not exists current_book_value numeric,
  add column if not exists residual_value numeric,
  add column if not exists notes text,
  add column if not exists department text,
  add column if not exists tags text[] not null default '{}'::text[],
  add column if not exists archived_at timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists parent_asset_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'assets_criticality_allowed'
  ) then
    alter table public.assets
      add constraint assets_criticality_allowed
      check (criticality is null or criticality in ('low', 'medium', 'high', 'critical'));
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'assets_useful_life_years_range'
  ) then
    alter table public.assets
      add constraint assets_useful_life_years_range
      check (useful_life_years is null or useful_life_years between 1 and 100);
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'assets_parent_asset_id_fkey'
  ) then
    alter table public.assets
      add constraint assets_parent_asset_id_fkey
      foreign key (parent_asset_id) references public.assets (id) on delete set null;
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'assets_parent_not_self'
  ) then
    alter table public.assets
      add constraint assets_parent_not_self
      check (parent_asset_id is distinct from id);
  end if;
end $$;

create index if not exists assets_company_name_idx on public.assets (company_id, name);
create index if not exists assets_company_code_idx on public.assets (company_id, asset_code);
create index if not exists assets_company_serial_idx on public.assets (company_id, serial_number);
create index if not exists assets_parent_idx on public.assets (parent_asset_id);
create index if not exists assets_active_idx on public.assets (company_id) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- Transfer acknowledgement
-- ---------------------------------------------------------------------------
alter table public.asset_transfers
  add column if not exists status text,
  add column if not exists rejected_at timestamptz,
  add column if not exists rejection_reason text;

update public.asset_transfers
set status = case
  when acknowledged_at is not null then 'accepted'
  else 'accepted'
end
where status is null;

alter table public.asset_transfers
  alter column status set default 'pending';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'asset_transfers_status_allowed'
  ) then
    alter table public.asset_transfers
      add constraint asset_transfers_status_allowed
      check (status in ('pending', 'accepted', 'rejected'));
  end if;
end $$;

update public.asset_transfers set status = 'accepted' where status is null;
alter table public.asset_transfers alter column status set not null;

create index if not exists asset_transfers_pending_idx
  on public.asset_transfers (company_id, to_user_id)
  where status = 'pending';

-- ---------------------------------------------------------------------------
-- Preventive maintenance
-- ---------------------------------------------------------------------------
alter table public.maintenance_plans
  add column if not exists instructions text;

-- ---------------------------------------------------------------------------
-- Audit extras
-- ---------------------------------------------------------------------------
alter table public.audit_items
  add column if not exists assigned_to uuid references public.users (id) on delete set null,
  add column if not exists found_custodian_id uuid references public.users (id) on delete set null;

insert into public.audit_exception_types (company_id, key, name, is_system, sort_order)
select c.id, x.key, x.name, true, x.sort_order
from public.companies c
cross join (
  values
    ('damaged', 'Damaged asset', 9),
    ('unreadable_qr', 'Unreadable QR', 10),
    ('other', 'Other', 11)
) as x(key, name, sort_order)
on conflict (company_id, key) do nothing;

-- ---------------------------------------------------------------------------
-- QR generation / print history (does not change public /tag/{id} URLs)
-- ---------------------------------------------------------------------------
create table if not exists public.qr_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  asset_id uuid not null references public.assets (id) on delete cascade,
  event_type text not null,
  actor_id uuid references public.users (id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint qr_events_type_allowed
    check (event_type in ('generated', 'regenerated', 'printed', 'replaced'))
);

create index if not exists qr_events_asset_idx on public.qr_events (asset_id, created_at desc);
create index if not exists qr_events_company_idx on public.qr_events (company_id);

alter table public.qr_events enable row level security;

drop policy if exists "qr_events_tenant_isolation" on public.qr_events;
create policy "qr_events_tenant_isolation" on public.qr_events
  for all to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

drop policy if exists "qr_events_super_admin_bypass" on public.qr_events;
create policy "qr_events_super_admin_bypass" on public.qr_events
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- ---------------------------------------------------------------------------
-- Transfer email templates
-- ---------------------------------------------------------------------------
insert into public.email_templates (company_id, event_key, subject, html_body, text_body)
select c.id, x.event_key, x.subject, x.html_body, x.text_body
from public.companies c
cross join (
  values
    (
      'transfer_pending',
      'Transfer pending: {{asset_name}}',
      '<p>{{asset_name}} ({{asset_code}}) is waiting for you to accept or reject a transfer.</p><p><a href="{{asset_url}}">Open asset</a></p>',
      '{{asset_name}} ({{asset_code}}) is waiting for transfer acknowledgement. {{asset_url}}'
    ),
    (
      'transfer_accepted',
      'Transfer accepted: {{asset_name}}',
      '<p>The transfer of {{asset_name}} ({{asset_code}}) was accepted.</p>',
      'Transfer of {{asset_name}} accepted.'
    ),
    (
      'transfer_rejected',
      'Transfer rejected: {{asset_name}}',
      '<p>The transfer of {{asset_name}} ({{asset_code}}) was rejected.</p>',
      'Transfer of {{asset_name}} rejected.'
    )
) as x(event_key, subject, html_body, text_body)
on conflict (company_id, event_key) do nothing;
