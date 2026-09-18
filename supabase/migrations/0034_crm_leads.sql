-- Platform CRM for public demo bookings and inquiries. These leads are
-- TagX-wide (no company_id): they arrive before a tenant exists. Super
-- admins read/update them; public inserts go through a server action that
-- uses the service role after validation + rate limiting.

insert into public.reserved_slugs (slug) values
  ('demo'),
  ('inquire'),
  ('enquiry'),
  ('contact'),
  ('leads'),
  ('crm'),
  ('asset-management-system')
on conflict (slug) do nothing;

create table public.crm_leads (
  id uuid primary key default gen_random_uuid(),
  source text not null
    constraint crm_leads_source_check check (source in ('demo', 'inquire')),
  full_name text not null
    constraint crm_leads_name_len check (char_length(full_name) between 1 and 200),
  email text not null
    constraint crm_leads_email_len check (char_length(email) between 3 and 254),
  phone text
    constraint crm_leads_phone_len check (phone is null or char_length(phone) between 7 and 20),
  company_name text
    constraint crm_leads_company_len check (company_name is null or char_length(company_name) <= 200),
  job_title text
    constraint crm_leads_job_title_len check (job_title is null or char_length(job_title) <= 120),
  asset_count text
    constraint crm_leads_asset_count_len check (asset_count is null or char_length(asset_count) <= 40),
  message text
    constraint crm_leads_message_len check (message is null or char_length(message) <= 2000),
  preferred_date date,
  status text not null default 'new'
    constraint crm_leads_status_check check (status in ('new', 'contacted', 'qualified', 'converted', 'closed')),
  notes text
    constraint crm_leads_notes_len check (notes is null or char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index crm_leads_created_at_idx on public.crm_leads (created_at desc);
create index crm_leads_status_idx on public.crm_leads (status);
create index crm_leads_source_idx on public.crm_leads (source);

create trigger set_crm_leads_updated_at
  before update on public.crm_leads
  for each row execute function public.set_updated_at();

alter table public.crm_leads enable row level security;

create policy "crm_leads_super_admin_all" on public.crm_leads
  for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());
