-- companies: the tenant root. Every other tenant-scoped table hangs off
-- companies.id via a `company_id` foreign key.

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  -- Lowercase, alphanumeric segments separated by single hyphens, no
  -- leading/trailing hyphen, no double hyphen: "acme", "acme-co-2".
  slug text not null
    constraint companies_slug_format check (
      slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
      and char_length(slug) between 2 and 63
    ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index companies_slug_key on public.companies (slug);

create trigger set_companies_updated_at
  before update on public.companies
  for each row execute function public.set_updated_at();

alter table public.companies enable row level security;

-- A company's own members may read/update their own row.
create policy "companies_tenant_isolation" on public.companies
  for all
  to authenticated
  using (id = public.current_company_id())
  with check (id = public.current_company_id());

create policy "companies_super_admin_bypass" on public.companies
  for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- Deliberately no INSERT policy for plain tenant members: a brand-new user
-- has no company yet, so `current_company_id()` is null and the tenant
-- policy's WITH CHECK can never pass for them. Company creation is a
-- privileged, service-role operation performed by
-- `modules/companies/actions.ts` (which also enforces the reserved-slug
-- check from migration 0004 and slug uniqueness), not a direct client insert.
