-- Razorpay ids on plans/subscriptions/orders, plus a wider subscription
-- status set so a workspace can exist before the first payment is captured.

alter table public.billing_plans
  add column razorpay_plan_id text unique;

alter table public.company_subscriptions
  drop constraint company_subscriptions_status_check;

alter table public.company_subscriptions
  add constraint company_subscriptions_status_check
  check (status in ('pending_payment', 'active', 'past_due', 'halted', 'canceled'));

alter table public.company_subscriptions
  add column razorpay_customer_id text,
  add column razorpay_subscription_id text unique,
  add column payment_confirm_token text unique;

alter table public.billing_orders
  add column razorpay_order_id text unique,
  add column razorpay_payment_id text;

create table public.razorpay_webhook_events (
  event_id text primary key,
  event_type text not null,
  processed_at timestamptz not null default now()
);

alter table public.razorpay_webhook_events enable row level security;

-- Platform table: only the service-role client (webhook) writes these.
-- Super admins can read for debugging.
create policy "razorpay_webhook_events_super_admin_read" on public.razorpay_webhook_events
  for select
  to authenticated
  using (public.is_super_admin());
