-- The seeded "Admin" role (is_system = true) is supposed to always carry
-- every permission (see modules/roles/mutations.ts's createSystemAdminRole,
-- which inserts FULL_PERMISSIONS from lib/permissions/taxonomy.ts). But
-- taxonomy.ts's module list has grown since some companies were created
-- (audits, settings, notifications were added later), and FULL_PERMISSIONS
-- is generated in TypeScript, not stored anywhere Postgres can re-derive —
-- so any company created before those modules existed has an Admin role
-- permanently missing them. Re-stamp every is_system role with the
-- complete current set so this doesn't recur silently.
update public.roles
set permissions = (
  select jsonb_object_agg(module, to_jsonb(array['view', 'create', 'edit', 'delete']))
  from unnest(array[
    'assets', 'categories', 'locations', 'statuses', 'maintenance',
    'users', 'roles', 'audits', 'notifications', 'settings'
  ]) as module
)
where is_system = true;
