-- Platform pricing plans, per-company subscriptions, and extra-asset
-- orders. Plans are TagX-wide (no company_id): the super admin sets the
-- monthly price and asset cap, then each tenant either picks a plan on
-- the public landing page or is assigned one when the super admin
-- provisions the company. Extra assets are sold in packs defined on the
-- plan (e.g. ₹1,499 for +100 assets) and applied after the super admin
-- marks the order fulfilled.

-- Public routes added for self-serve signup. Keep in sync with the
-- mirror in src/lib/tenant.ts.
insert into public.reserved_slugs (slug) values
  ('signup'),
  ('pricing'),
  ('plans'),
  ('billing')
on conflict (slug) do nothing;

create table public.billing_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null
    constraint billing_plans_name_len check (char_length(name) between 1 and 80),
  description text
    constraint billing_plans_description_len check (description is null or char_length(description) <= 500),
  price_monthly integer not null
    constraint billing_plans_price_monthly_nonneg check (price_monthly >= 0),
  currency text not null default 'INR'
    constraint billing_plans_currency_format check (currency ~ '^[A-Z]{3}$'),
  asset_limit integer not null
    constraint billing_plans_asset_limit_positive check (asset_limit > 0),
  extra_asset_quantity integer not null
    constraint billing_plans_extra_qty_positive check (extra_asset_quantity > 0),
  extra_asset_price integer not null
    constraint billing_plans_extra_price_nonneg check (extra_asset_price >= 0),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_billing_plans_updated_at
  before update on public.billing_plans
  for each row execute function public.set_updated_at();

create table public.company_subscriptions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null unique references public.companies (id) on delete cascade,
  plan_id uuid not null references public.billing_plans (id) on delete restrict,
  extra_assets integer not null default 0
    constraint company_subscriptions_extra_assets_nonneg check (extra_assets >= 0),
  status text not null default 'active'
    constraint company_subscriptions_status_check check (status in ('active', 'canceled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index company_subscriptions_plan_id_idx on public.company_subscriptions (plan_id);

create trigger set_company_subscriptions_updated_at
  before update on public.company_subscriptions
  for each row execute function public.set_updated_at();

create table public.billing_orders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  plan_id uuid not null references public.billing_plans (id) on delete restrict,
  packs integer not null
    constraint billing_orders_packs_positive check (packs > 0),
  asset_quantity integer not null
    constraint billing_orders_asset_quantity_positive check (asset_quantity > 0),
  amount integer not null
    constraint billing_orders_amount_nonneg check (amount >= 0),
  currency text not null default 'INR'
    constraint billing_orders_currency_format check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'pending'
    constraint billing_orders_status_check check (status in ('pending', 'fulfilled', 'canceled')),
  created_by uuid references auth.users (id) on delete set null,
  fulfilled_by uuid references auth.users (id) on delete set null,
  fulfilled_at timestamptz,
  notes text
    constraint billing_orders_notes_len check (notes is null or char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index billing_orders_company_id_idx on public.billing_orders (company_id);
create index billing_orders_status_idx on public.billing_orders (status);

create trigger set_billing_orders_updated_at
  before update on public.billing_orders
  for each row execute function public.set_updated_at();

alter table public.billing_plans enable row level security;
alter table public.company_subscriptions enable row level security;
alter table public.billing_orders enable row level security;

-- Visitors need active plans to render the public pricing page / signup.
create policy "billing_plans_public_read_active" on public.billing_plans
  for select
  to anon, authenticated
  using (is_active = true);

create policy "billing_plans_super_admin_bypass" on public.billing_plans
  for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy "company_subscriptions_tenant_select" on public.company_subscriptions
  for select
  to authenticated
  using (company_id = public.current_company_id());

create policy "company_subscriptions_super_admin_bypass" on public.company_subscriptions
  for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy "billing_orders_tenant_select" on public.billing_orders
  for select
  to authenticated
  using (company_id = public.current_company_id());

-- Tenants may open a pending extra-asset order for themselves. Fulfillment
-- (and any other status change) is super-admin only via the bypass policy.
create policy "billing_orders_tenant_insert" on public.billing_orders
  for insert
  to authenticated
  with check (
    company_id = public.current_company_id()
    and status = 'pending'
  );

create policy "billing_orders_super_admin_bypass" on public.billing_orders
  for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- Super-admin company list: one grouped count per tenant. security invoker
-- so RLS (including companies_super_admin_bypass on assets) still applies.
create or replace function public.get_company_asset_counts()
returns table (company_id uuid, asset_count bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select a.company_id, count(*)::bigint as asset_count
  from public.assets a
  group by a.company_id;
$$;

grant execute on function public.get_company_asset_counts() to authenticated;

-- Marks a pending extra-asset order paid and bumps the company's extra
-- asset allowance in one statement, so we never fulfill without granting
-- (or grant without fulfilling). Invoker + super-admin RLS bypass.
create or replace function public.fulfill_billing_order(p_order_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_company_id uuid;
  v_qty integer;
  v_status text;
begin
  select company_id, asset_quantity, status
    into v_company_id, v_qty, v_status
  from public.billing_orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;

  if v_status <> 'pending' then
    raise exception 'Order is not pending' using errcode = 'P0001';
  end if;

  update public.billing_orders
    set
      status = 'fulfilled',
      fulfilled_by = auth.uid(),
      fulfilled_at = now()
    where id = p_order_id;

  update public.company_subscriptions
    set extra_assets = extra_assets + v_qty
    where company_id = v_company_id;

  if not found then
    raise exception 'Subscription not found' using errcode = 'P0002';
  end if;
end;
$$;

grant execute on function public.fulfill_billing_order(uuid) to authenticated;

insert into public.billing_plans (
  name,
  description,
  price_monthly,
  asset_limit,
  extra_asset_quantity,
  extra_asset_price,
  is_active,
  sort_order
)
values
  (
    'Starter',
    'For teams getting started with tagged assets across a few sites.',
    6999,
    500,
    100,
    1499,
    true,
    1
  ),
  (
    'Growth',
    'More room as the register grows — still billed monthly.',
    12999,
    1500,
    250,
    2499,
    true,
    2
  ),
  (
    'Scale',
    'For large inventories and many locations.',
    24999,
    5000,
    500,
    3999,
    true,
    3
  );
