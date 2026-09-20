-- Reshapes public.assets to match the actual create/edit form (Basic /
-- Additional / Purchase Info — see docs/asset-fields.md). Renaming and
-- dropping in place rather than adding alongside: no asset rows exist in
-- any environment yet at this stage of the build.

alter table public.assets rename column manufacturer to brand;
alter table public.assets rename column warranty_expiry to warranty_end_date;
alter table public.assets rename column assigned_to to allotted_to;
-- Column rename doesn't rename the constraint; do that explicitly so a
-- PostgREST embed hint like `!assets_allotted_to_fkey` actually matches
-- the column it looks like it matches.
alter table public.assets rename constraint assets_assigned_to_fkey to assets_allotted_to_fkey;

alter table public.assets
  drop column currency,
  drop column depreciation_method,
  drop column useful_life_months,
  drop column salvage_value,
  drop column notes;

alter table public.assets
  add column image_url text,
  add column cwip_invoice_id text,
  add column linked_asset_id uuid references public.assets (id) on delete set null,
  add column po_number text,
  add column invoice_date date,
  add column invoice_number text,
  add column ownership_type text not null default 'owned'
    check (ownership_type in ('owned', 'partner')),
  add column partner_name text,
  add column allotment_date date,
  add column warranty_start_date date,
  add column amc_provider text,
  add column amc_start_date date,
  add column amc_end_date date,
  add column insurance_provider text,
  add column insurance_policy_number text,
  add column insurance_expiry_date date;

create index assets_linked_asset_id_idx on public.assets (linked_asset_id);

-- Auto-generated asset codes (modules/assets/mutations.ts) need a durable
-- per-company counter; company_settings.asset_code_format already holds
-- the template string (e.g. 'AST-{SEQ:05d}') that the counter fills in.
alter table public.company_settings
  add column next_asset_sequence integer not null default 1;

-- Atomically hands out the next sequence number and bumps the counter,
-- in one round trip, upserting a company_settings row if the company
-- doesn't have one yet. The `on conflict` update takes a row lock, so two
-- concurrent asset creations can't be handed the same number.
create or replace function public.increment_asset_sequence(p_company_id uuid)
returns integer
language sql
security invoker
set search_path = public
as $$
  insert into public.company_settings (company_id, next_asset_sequence)
  values (p_company_id, 2)
  on conflict (company_id)
  do update set next_asset_sequence = company_settings.next_asset_sequence + 1
  returning next_asset_sequence - 1;
$$;

grant execute on function public.increment_asset_sequence(uuid) to authenticated;
