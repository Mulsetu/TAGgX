-- Configurable multi-tenant platform: plan-included modules, storage quota
-- on plans, and per-company workspace JSON (fields, dashboard, workflows).
-- Reuses company_settings and billing_plans. Idempotent.

-- ---------------------------------------------------------------------------
-- Plans: which modules a tenant may enable, plus storage quota
-- ---------------------------------------------------------------------------
alter table public.billing_plans
  add column if not exists included_modules jsonb,
  add column if not exists storage_limit_bytes bigint;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'billing_plans_storage_limit_nonneg'
  ) then
    alter table public.billing_plans
      add constraint billing_plans_storage_limit_nonneg
      check (storage_limit_bytes is null or storage_limit_bytes >= 0);
  end if;
end $$;

comment on column public.billing_plans.included_modules is
  'JSON array of feature module keys included in this plan. NULL means every module is available.';
comment on column public.billing_plans.storage_limit_bytes is
  'Copied onto company_settings.storage_limit_bytes when the plan is assigned. NULL keeps the company default.';

-- ---------------------------------------------------------------------------
-- Company workspace configuration (tenant-scoped JSON, not new tables)
-- ---------------------------------------------------------------------------
alter table public.company_settings
  add column if not exists asset_field_config jsonb not null default '{}'::jsonb,
  add column if not exists dashboard_widgets jsonb not null default '{}'::jsonb,
  add column if not exists workflow_config jsonb not null default '{}'::jsonb,
  add column if not exists department_catalog jsonb not null default '[]'::jsonb,
  add column if not exists disposal_methods jsonb not null default '[]'::jsonb;

comment on column public.company_settings.asset_field_config is
  'Per-field enable/required/label/order for built-in asset form fields.';
comment on column public.company_settings.dashboard_widgets is
  'Widget id -> { enabled, order } for the company dashboard.';
comment on column public.company_settings.workflow_config is
  'Optional approval flags, e.g. transfer_approval, disposal_approval.';
comment on column public.company_settings.department_catalog is
  'Company-managed department names used on the asset form.';
comment on column public.company_settings.disposal_methods is
  'Company-managed disposal method labels.';

-- Existing tenants keep current module behaviour: the six original flags
-- stay true; newer keys are interpreted in application code with inherit
-- rules so we do not flip production companies overnight.

grant insert (
  company_id,
  asset_code_format,
  enabled_modules,
  asset_field_config,
  dashboard_widgets,
  workflow_config,
  department_catalog,
  disposal_methods
) on public.company_settings to authenticated;

grant update (
  asset_code_format,
  enabled_modules,
  asset_field_config,
  dashboard_widgets,
  workflow_config,
  department_catalog,
  disposal_methods
) on public.company_settings to authenticated;
