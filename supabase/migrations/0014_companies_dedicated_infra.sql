-- Flag only, for now: marks a company as eventually needing dedicated
-- DB/storage infrastructure instead of the shared multi-tenant stack.
-- No provisioning logic reads this yet — it's just recorded on the
-- company record so the super-admin UI can set it ahead of that work.
alter table public.companies
  add column is_dedicated_infra boolean not null default false;
