-- Row Level Security checks against a real database (pgTAP).
-- Run with the local Supabase stack:  supabase start && supabase test db
-- Everything runs inside one transaction and is rolled back at the end.
-- Most useful after seeding: the "stranger" checks look at whatever rows exist.

begin;
create extension if not exists pgtap with schema extensions;

select plan(7);

-- 1. RLS is switched on for every table in the public schema.
select is_empty(
  $$ select c.relname::text
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity $$,
  'every public table has row level security enabled'
);

-- 2. ...and every one of them has at least one policy (RLS with no policy silently denies everything).
select is_empty(
  $$ select c.relname::text
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r'
       and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname) $$,
  'every public table has at least one policy'
);

-- 3. Tenant tables (with a company_id column) have a policy that actually scopes by tenant.
select is_empty(
  $$ select distinct col.table_name::text
     from information_schema.columns col
     join information_schema.tables t on t.table_schema = col.table_schema and t.table_name = col.table_name
     where col.table_schema = 'public' and col.column_name = 'company_id' and t.table_type = 'BASE TABLE'
       and not exists (
         select 1 from pg_policies p
         where p.schemaname = 'public' and p.tablename = col.table_name
           and (coalesce(p.qual, '') || coalesce(p.with_check, '')) ~* '(company_id|current_company_id|is_super_admin)'
       ) $$,
  'every tenant table has a company-scoped policy'
);

-- 4. No policy on a tenant table is open to the anon (signed-out) role.
select is_empty(
  $$ select p.tablename || ' / ' || p.policyname
     from pg_policies p
     where p.schemaname = 'public'
       and ('anon' = any(p.roles) or 'public' = any(p.roles))
       and exists (select 1 from information_schema.columns c
                   where c.table_schema = 'public' and c.table_name = p.tablename and c.column_name = 'company_id') $$,
  'no tenant table has a policy for anon/public'
);

-- 5. SECURITY DEFINER functions pin search_path (prevents search_path hijacking).
select is_empty(
  $$ select p.proname::text
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prosecdef
       and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) cfg where cfg like 'search_path=%') $$,
  'every SECURITY DEFINER function sets search_path'
);

-- 6 + 7. Impersonate accounts that belong to no company and check they see nothing.
create function public.__rls_test_visible_tables(tables text[]) returns setof text
language plpgsql security invoker as $$
declare
  t text;
  n bigint;
begin
  foreach t in array tables loop
    begin
      execute format('select count(*) from public.%I', t) into n;
    exception when insufficient_privilege then
      n := 0; -- no grant at all is also "can't see it"
    end;
    if n > 0 then
      return next t || ' (' || n || ' rows)';
    end if;
  end loop;
end;
$$;
grant execute on function public.__rls_test_visible_tables(text[]) to anon, authenticated;

create temp table __tenant_tables on commit drop as
  select array_agg(distinct col.table_name::text) as names
  from information_schema.columns col
  join information_schema.tables t on t.table_schema = col.table_schema and t.table_name = col.table_name
  where col.table_schema = 'public' and col.column_name = 'company_id' and t.table_type = 'BASE TABLE';
grant select on __tenant_tables to anon, authenticated;

-- A signed-in stranger: valid JWT, no row in public.users, not a platform admin.
select set_config('request.jwt.claims', '{"sub":"7f1c2a9e-0000-4000-8000-00000000beef","role":"authenticated"}', true);
set local role authenticated;
select is_empty(
  $$ select public.__rls_test_visible_tables((select names from __tenant_tables)) $$,
  'an authenticated user with no company sees no tenant rows'
);
reset role;

-- Signed out.
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select is_empty(
  $$ select public.__rls_test_visible_tables((select names from __tenant_tables)) $$,
  'a signed-out visitor sees no tenant rows'
);
reset role;

select * from finish();
rollback;
