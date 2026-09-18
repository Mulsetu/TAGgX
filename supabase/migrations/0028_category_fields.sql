-- Per-category extra fields for assets. Admins define the shape;
-- values live on assets.custom_fields (jsonb, already on the table).
create table public.category_fields (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  category_id uuid not null references public.asset_categories (id) on delete cascade,
  label text not null,
  key text not null,
  field_type text not null,
  required boolean not null default false,
  options jsonb not null default '[]'::jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (category_id, key),
  constraint category_fields_label_len check (char_length(label) between 1 and 200),
  constraint category_fields_key_format check (key ~ '^[a-z][a-z0-9_]{0,63}$'),
  constraint category_fields_type_allowed check (field_type in ('text', 'number', 'date', 'select', 'checkbox'))
);

create index category_fields_company_id_idx on public.category_fields (company_id);
create index category_fields_category_id_idx on public.category_fields (category_id);

create trigger set_category_fields_updated_at
  before update on public.category_fields
  for each row execute function public.set_updated_at();

alter table public.category_fields enable row level security;

create policy "category_fields_tenant_isolation" on public.category_fields
  for all
  to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

create policy "category_fields_super_admin_bypass" on public.category_fields
  for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());
