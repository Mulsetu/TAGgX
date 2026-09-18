create table public.email_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  event_key text not null,
  subject text not null,
  html_body text not null,
  text_body text not null,
  is_enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  unique (company_id, event_key)
);

create trigger set_email_templates_updated_at
  before update on public.email_templates
  for each row execute function public.set_updated_at();

alter table public.email_templates enable row level security;
create policy "email_templates_tenant_isolation" on public.email_templates
  for all to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());
create policy "email_templates_super_admin_bypass" on public.email_templates
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

create table public.notification_rules (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  event_key text not null,
  offset_days integer not null default 0,
  recipient text not null default 'admins',
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (company_id, event_key, offset_days, recipient)
);

alter table public.notification_rules enable row level security;
create policy "notification_rules_tenant_isolation" on public.notification_rules
  for all to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());
create policy "notification_rules_super_admin_bypass" on public.notification_rules
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

create table public.notification_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  event_key text not null,
  entity_id uuid,
  occurrence_key text not null,
  recipient_email text not null,
  status text not null,
  error text,
  sent_at timestamptz not null default now(),
  unique (company_id, event_key, occurrence_key, recipient_email)
);

create index notification_logs_company_idx on public.notification_logs (company_id, sent_at desc);

alter table public.notification_logs enable row level security;
create policy "notification_logs_tenant_read" on public.notification_logs
  for select to authenticated
  using (company_id = public.current_company_id());
create policy "notification_logs_super_admin_bypass" on public.notification_logs
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

insert into public.email_templates (company_id, event_key, subject, html_body, text_body)
select c.id, x.event_key, x.subject, x.html_body, x.text_body
from public.companies c
cross join (
  values
    ('asset_assigned', 'Asset assigned: {{asset_name}}', '<p>{{asset_name}} ({{asset_code}}) was assigned.</p><p><a href="{{asset_url}}">Open asset</a></p>', '{{asset_name}} ({{asset_code}}) was assigned. {{asset_url}}'),
    ('asset_returned', 'Asset returned: {{asset_name}}', '<p>{{asset_name}} ({{asset_code}}) was returned.</p>', '{{asset_name}} returned.'),
    ('asset_transferred', 'Asset transferred: {{asset_name}}', '<p>{{asset_name}} ({{asset_code}}) was transferred.</p>', '{{asset_name}} transferred.'),
    ('maintenance_created', 'Maintenance ticket: {{maintenance_title}}', '<p>Ticket {{ticket_number}} created for {{asset_name}}.</p>', 'Ticket created for {{asset_name}}.'),
    ('maintenance_assigned', 'Maintenance assigned: {{maintenance_title}}', '<p>{{maintenance_title}} was assigned.</p>', '{{maintenance_title}} assigned.'),
    ('maintenance_due', 'Maintenance due: {{asset_name}}', '<p>{{asset_name}} maintenance is due {{due_date}}.</p>', '{{asset_name}} due {{due_date}}.'),
    ('warranty_expiry', 'Warranty due: {{asset_name}}', '<p>{{asset_name}} warranty is due {{due_date}}.</p>', '{{asset_name}} warranty {{due_date}}.'),
    ('amc_expiry', 'AMC due: {{asset_name}}', '<p>{{asset_name}} AMC is due {{due_date}}.</p>', '{{asset_name}} AMC {{due_date}}.'),
    ('insurance_expiry', 'Insurance due: {{asset_name}}', '<p>{{asset_name}} insurance is due {{due_date}}.</p>', '{{asset_name}} insurance {{due_date}}.'),
    ('vendor_assigned', 'Vendor assignment: {{asset_name}}', '<p>{{vendor_name}} was assigned to {{asset_name}} / {{maintenance_title}}.</p>', '{{vendor_name}} assigned.'),
    ('document_expiry', 'Document expiring: {{asset_name}}', '<p>A document on {{asset_name}} expires {{due_date}}.</p>', 'Document expiry {{due_date}}.')
) as x(event_key, subject, html_body, text_body);

insert into public.notification_rules (company_id, event_key, offset_days, recipient)
select c.id, x.event_key, x.offset_days, 'admins'
from public.companies c
cross join (
  values
    ('warranty_expiry', 30),
    ('warranty_expiry', 15),
    ('warranty_expiry', 7),
    ('warranty_expiry', 1),
    ('warranty_expiry', 0),
    ('amc_expiry', 30),
    ('amc_expiry', 7),
    ('amc_expiry', 0),
    ('insurance_expiry', 30),
    ('insurance_expiry', 7),
    ('insurance_expiry', 0),
    ('maintenance_due', 7),
    ('maintenance_due', 1),
    ('maintenance_due', 0)
) as x(event_key, offset_days);
