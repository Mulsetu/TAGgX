-- Onboarding accounts (user before company), richer subscriptions, and
-- real payment records. Idempotent. Does not rewrite existing tenant data.

insert into public.reserved_slugs (slug) values
  ('onboarding'),
  ('auth'),
  ('verify')
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- Users may exist before they belong to a company (self-serve signup).
-- ---------------------------------------------------------------------------
alter table public.users
  alter column company_id drop not null,
  alter column role_id drop not null;

drop policy if exists "users_self_select" on public.users;
create policy "users_self_select" on public.users
  for select
  to authenticated
  using (id = auth.uid());

comment on column public.users.company_id is
  'Null only during self-serve onboarding, before a workspace is created.';

-- ---------------------------------------------------------------------------
-- Plans: optional user cap
-- ---------------------------------------------------------------------------
alter table public.billing_plans
  add column if not exists user_limit integer;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'billing_plans_user_limit_positive'
  ) then
    alter table public.billing_plans
      add constraint billing_plans_user_limit_positive
      check (user_limit is null or user_limit > 0);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Subscriptions: type, dates, cycle — payment stays a separate table
-- ---------------------------------------------------------------------------
alter table public.company_subscriptions
  drop constraint if exists company_subscriptions_status_check;

alter table public.company_subscriptions
  add constraint company_subscriptions_status_check
  check (status in (
    'draft',
    'trial',
    'pending_payment',
    'active',
    'past_due',
    'expired',
    'suspended',
    'halted',
    'canceled'
  ));

alter table public.company_subscriptions
  add column if not exists subscription_type text not null default 'self_service',
  add column if not exists billing_cycle text not null default 'monthly',
  add column if not exists starts_at timestamptz not null default now(),
  add column if not exists ends_at timestamptz,
  add column if not exists trial_starts_at timestamptz,
  add column if not exists trial_ends_at timestamptz,
  add column if not exists auto_renew boolean not null default true;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'company_subscriptions_type_check'
  ) then
    alter table public.company_subscriptions
      add constraint company_subscriptions_type_check
      check (subscription_type in (
        'self_service',
        'sales_assisted',
        'demo',
        'trial',
        'enterprise',
        'complimentary'
      ));
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'company_subscriptions_cycle_check'
  ) then
    alter table public.company_subscriptions
      add constraint company_subscriptions_cycle_check
      check (billing_cycle in ('monthly', 'yearly', 'custom'));
  end if;
end $$;

update public.company_subscriptions
set subscription_type = case
  when razorpay_subscription_id is not null then 'self_service'
  else 'sales_assisted'
end
where subscription_type = 'self_service'
  and razorpay_subscription_id is null;

-- ---------------------------------------------------------------------------
-- Payments: financial events only. Never fake ₹0 rows for demo/comp accounts.
-- ---------------------------------------------------------------------------
create table if not exists public.billing_payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  subscription_id uuid references public.company_subscriptions (id) on delete set null,
  amount integer not null
    constraint billing_payments_amount_nonneg check (amount >= 0),
  currency text not null default 'INR'
    constraint billing_payments_currency_format check (currency ~ '^[A-Z]{3}$'),
  payment_method text not null
    constraint billing_payments_method_check check (payment_method in (
      'razorpay',
      'upi',
      'bank_transfer',
      'neft',
      'rtgs',
      'cash',
      'cheque',
      'other'
    )),
  payment_status text not null
    constraint billing_payments_status_check check (payment_status in (
      'pending',
      'paid',
      'failed',
      'cancelled',
      'partially_paid',
      'refunded',
      'waived'
    )),
  reference_number text
    constraint billing_payments_reference_len check (reference_number is null or char_length(reference_number) <= 120),
  payment_date date not null default (timezone('utc', now()))::date,
  provider text
    constraint billing_payments_provider_len check (provider is null or char_length(provider) <= 80),
  notes text
    constraint billing_payments_notes_len check (notes is null or char_length(notes) <= 1000),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists billing_payments_company_id_idx on public.billing_payments (company_id);
create index if not exists billing_payments_subscription_id_idx on public.billing_payments (subscription_id);
create unique index if not exists billing_payments_provider_reference_uidx
  on public.billing_payments (provider, reference_number)
  where provider is not null and reference_number is not null;

drop trigger if exists set_billing_payments_updated_at on public.billing_payments;
create trigger set_billing_payments_updated_at
  before update on public.billing_payments
  for each row execute function public.set_updated_at();

alter table public.billing_payments enable row level security;

drop policy if exists "billing_payments_tenant_select" on public.billing_payments;
create policy "billing_payments_tenant_select" on public.billing_payments
  for select
  to authenticated
  using (company_id = public.current_company_id());

drop policy if exists "billing_payments_super_admin_bypass" on public.billing_payments;
create policy "billing_payments_super_admin_bypass" on public.billing_payments
  for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

revoke insert, update, delete on public.billing_payments from anon, authenticated;
grant select on public.billing_payments to authenticated;
