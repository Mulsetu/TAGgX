-- Company setup invites: super admin creates a company + gives an admin
-- email, this table holds the one-time token that email's "set your
-- password" link carries. The accept flow (/invite/[token]) runs entirely
-- through the service-role client (the invitee has no session yet), so
-- there's no policy here granting authenticated/anon write access —
-- reads are for a company's own members checking pending invites later.
create table public.company_invites (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  role_id uuid not null references public.roles (id) on delete cascade,
  email text not null,
  token text not null,
  invited_by uuid references auth.users (id) on delete set null,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index company_invites_token_key on public.company_invites (token);
create index company_invites_company_id_idx on public.company_invites (company_id);

alter table public.company_invites enable row level security;

create policy "company_invites_tenant_read" on public.company_invites
  for select
  to authenticated
  using (company_id = public.current_company_id());

create policy "company_invites_super_admin_bypass" on public.company_invites
  for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());
