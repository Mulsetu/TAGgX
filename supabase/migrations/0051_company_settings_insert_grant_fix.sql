-- 0046 added company_settings.dashboard_layouts with an UPDATE grant only.
-- Settings saves go through PostgREST upsert (INSERT ... ON CONFLICT DO
-- UPDATE), and Postgres checks INSERT privilege on every column in the
-- insert list even when the row already exists — so every Settings section
-- failed with "permission denied for table company_settings".
--
-- Idempotent: safe to re-run, and also re-applies 0046's column in case a
-- database skipped that migration.
alter table public.company_settings
  add column if not exists dashboard_layouts jsonb not null default '{}'::jsonb;

grant insert (dashboard_layouts) on public.company_settings to authenticated;
grant update (dashboard_layouts) on public.company_settings to authenticated;
