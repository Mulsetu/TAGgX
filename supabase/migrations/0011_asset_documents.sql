-- Metadata for files stored in R2. file_path is the R2 object key, not a
-- public URL — access is brokered through a signed URL generated server
-- side in modules/storage/actions.ts, never read directly by the client.

create table public.asset_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  asset_id uuid not null references public.assets (id) on delete cascade,
  document_type text not null default 'other'
    check (document_type in ('invoice', 'warranty', 'manual', 'photo', 'other')),
  file_name text not null,
  file_path text not null,
  file_size_bytes bigint not null,
  mime_type text not null,
  uploaded_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index asset_documents_company_id_idx on public.asset_documents (company_id);
create index asset_documents_asset_id_idx on public.asset_documents (asset_id);

alter table public.asset_documents enable row level security;

create policy "asset_documents_tenant_isolation" on public.asset_documents
  for all
  to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

create policy "asset_documents_super_admin_bypass" on public.asset_documents
  for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());
