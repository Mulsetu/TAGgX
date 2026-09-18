-- Slugs that can never be used as a company slug, because they collide
-- with real routes/subdomains (see src/app routing). Enforced twice:
-- application-side in modules/companies/validation.ts for a fast, friendly
-- error, and here at the database level so the constraint can never be
-- bypassed by a bug or a direct insert.

create table public.reserved_slugs (
  slug text primary key
);

insert into public.reserved_slugs (slug) values
  ('admin'),
  ('api'),
  ('app'),
  ('www'),
  ('login'),
  ('dashboard'),
  ('assets'),
  ('static')
on conflict (slug) do nothing;

create or replace function public.check_slug_not_reserved()
returns trigger
language plpgsql
as $$
begin
  if exists (select 1 from public.reserved_slugs where slug = new.slug) then
    raise exception 'The slug "%" is reserved and cannot be used', new.slug
      using errcode = '23505';
  end if;
  return new;
end;
$$;

create trigger companies_check_slug_not_reserved
  before insert or update of slug on public.companies
  for each row execute function public.check_slug_not_reserved();

alter table public.reserved_slugs enable row level security;

-- Read-only lookup table; needed even pre-auth (signup slug-availability
-- check), so both anon and authenticated may select. Only migrations
-- (i.e. the table owner) can write to it.
create policy "reserved_slugs_read_all" on public.reserved_slugs
  for select
  to authenticated, anon
  using (true);
