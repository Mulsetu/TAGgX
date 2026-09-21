-- Backs two Settings-page features aimed at enterprise procurement
-- checklists ("can we get our data out", "can we ask you to delete it"):
-- self-serve workspace data export (no schema change needed — it reads
-- through the existing session-scoped RLS, same as every report) and a
-- deletion *request* flag a Company Admin can set. Deliberately a request,
-- not a self-serve hard delete: `company_id ... on delete cascade` makes
-- deleteCompany() irreversible in one click already (see
-- modules/companies/mutations.ts), and that's dangerous enough gated
-- behind a super admin who has to open /admin and type the slug to
-- confirm — putting the same button in front of every customer's Company
-- Admin with no human review step is how a phished or confused admin
-- account takes an entire paying tenant down with no way back.

alter table public.companies
  add column if not exists deletion_requested_at timestamptz,
  add column if not exists deletion_requested_by uuid references public.users (id) on delete set null,
  add column if not exists deletion_reason text;

comment on column public.companies.deletion_requested_at is
  'Set by a Company Admin via Settings > Danger zone. A TagX super admin reviews and completes the actual delete from /admin — see deleteCompanyAction.';

-- Not a column grant: unlike the branding fields 0043 opened up, these are
-- gated by "is the caller specifically a Company Admin", which a plain
-- column grant can't express (any authenticated member of the company
-- would qualify). RPCs re-check that at the database layer instead —
-- consistent with 0048's set_company_admin() etc. Actual data deletion
-- never happens here; these only flip a flag a super admin reviews.
create or replace function public.request_company_deletion(p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_is_admin boolean;
  target_company uuid;
begin
  select is_company_admin, company_id into caller_is_admin, target_company
  from public.users
  where id = auth.uid();

  if not coalesce(caller_is_admin, false) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if target_company is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  update public.companies
  set deletion_requested_at = now(),
      deletion_requested_by = auth.uid(),
      deletion_reason = p_reason
  where id = target_company;
end;
$$;

create or replace function public.cancel_company_deletion_request()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_is_admin boolean;
  target_company uuid;
begin
  select is_company_admin, company_id into caller_is_admin, target_company
  from public.users
  where id = auth.uid();

  if not coalesce(caller_is_admin, false) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if target_company is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  update public.companies
  set deletion_requested_at = null,
      deletion_requested_by = null,
      deletion_reason = null
  where id = target_company;
end;
$$;

revoke execute on function public.request_company_deletion(text) from anon, public;
revoke execute on function public.cancel_company_deletion_request() from anon, public;
grant execute on function public.request_company_deletion(text) to authenticated;
grant execute on function public.cancel_company_deletion_request() to authenticated;

-- No column grant on deletion_requested_at/deletion_requested_by/
-- deletion_reason for `authenticated` — every write goes through the two
-- RPCs above. SELECT is already covered by 0043's `grant select on
-- public.companies to authenticated`, so every staff member can see a
-- pending request (informational; only Company Admin can set or clear it).
