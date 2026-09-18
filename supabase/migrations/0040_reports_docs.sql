-- Audit extras, documents, imports.

create table public.audit_exception_types (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  key text not null,
  name text not null,
  is_system boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  unique (company_id, key)
);

alter table public.audit_exception_types enable row level security;
create policy "audit_exception_types_tenant_isolation" on public.audit_exception_types
  for all to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());
create policy "audit_exception_types_super_admin_bypass" on public.audit_exception_types
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

insert into public.audit_exception_types (company_id, key, name, is_system, sort_order)
select c.id, x.key, x.name, true, x.sort_order
from public.companies c
cross join (
  values
    ('missing', 'Missing', 1),
    ('wrong_location', 'Wrong location', 2),
    ('condition_mismatch', 'Condition mismatch', 3),
    ('wrong_custodian', 'Wrong custodian', 4),
    ('qr_damaged', 'QR code damaged', 5),
    ('not_registered', 'Asset not registered', 6),
    ('duplicate', 'Duplicate asset', 7),
    ('document_missing', 'Document missing', 8)
) as x(key, name, sort_order);

alter table public.audits
  add column if not exists require_photo_on_exception boolean not null default false,
  add column if not exists require_remark_on_exception boolean not null default false;

alter table public.asset_documents
  drop constraint if exists asset_documents_document_type_check;

alter table public.asset_documents
  add column if not exists expires_at date;

create table public.document_types (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  key text not null,
  name text not null,
  is_system boolean not null default false,
  unique (company_id, key)
);

alter table public.document_types enable row level security;
create policy "document_types_tenant_isolation" on public.document_types
  for all to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());
create policy "document_types_super_admin_bypass" on public.document_types
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

insert into public.document_types (company_id, key, name, is_system)
select c.id, x.key, x.name, true
from public.companies c
cross join (
  values
    ('invoice', 'Purchase invoice'),
    ('warranty', 'Warranty certificate'),
    ('manual', 'Manual'),
    ('photo', 'Photo'),
    ('amc', 'AMC agreement'),
    ('insurance', 'Insurance document'),
    ('handover', 'Handover receipt'),
    ('other', 'Other')
) as x(key, name);

create table public.category_required_documents (
  category_id uuid not null references public.asset_categories (id) on delete cascade,
  document_type_key text not null,
  company_id uuid not null references public.companies (id) on delete cascade,
  primary key (category_id, document_type_key)
);

alter table public.category_required_documents enable row level security;
create policy "category_required_documents_tenant_isolation" on public.category_required_documents
  for all to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());
create policy "category_required_documents_super_admin_bypass" on public.category_required_documents
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

create table public.import_jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  created_by uuid references public.users (id) on delete set null,
  status text not null default 'completed',
  total_rows integer not null default 0,
  success_count integer not null default 0,
  error_count integer not null default 0,
  error_report text,
  created_at timestamptz not null default now()
);

alter table public.import_jobs enable row level security;
create policy "import_jobs_tenant_isolation" on public.import_jobs
  for all to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());
create policy "import_jobs_super_admin_bypass" on public.import_jobs
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());
