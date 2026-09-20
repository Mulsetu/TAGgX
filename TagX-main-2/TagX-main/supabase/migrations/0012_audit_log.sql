-- Append-only trail of who did what. Deliberately more restrictive than
-- the standard tenant pattern: tenant members can SELECT their company's
-- entries but there is no INSERT/UPDATE/DELETE policy for `authenticated`
-- at all, so a compromised or buggy client session can never edit or erase
-- history. Writes happen exclusively through the service-role client
-- (which bypasses RLS by design), called from each module's actions.ts
-- after a mutation succeeds.

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  actor_id uuid references public.users (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  old_values jsonb,
  new_values jsonb,
  ip_address inet,
  created_at timestamptz not null default now()
);

create index audit_log_company_id_idx on public.audit_log (company_id);
create index audit_log_entity_idx on public.audit_log (entity_type, entity_id);
create index audit_log_created_at_idx on public.audit_log (created_at desc);

alter table public.audit_log enable row level security;

create policy "audit_log_tenant_read" on public.audit_log
  for select
  to authenticated
  using (company_id = public.current_company_id());

create policy "audit_log_super_admin_bypass" on public.audit_log
  for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());
