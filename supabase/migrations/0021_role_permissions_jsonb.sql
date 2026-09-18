-- Replaces the relational permissions/role_permissions catalog (migration
-- 0005) with a single JSONB column on roles, per the Administration
-- role-editor design: { [module]: [action, ...] }, e.g.
-- { "assets": ["view", "create"], "roles": ["view"] }. Neither old table
-- was ever read or written by application code, so nothing to migrate.
drop table if exists public.role_permissions;
drop table if exists public.permissions;

alter table public.roles
  add column permissions jsonb not null default '{}'::jsonb;
