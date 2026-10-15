import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { TENANT_HEADERS } from "@/lib/tenant";
import { requirePermission } from "@/lib/permissions/has-permission";
import type { PermissionAction, PermissionModule } from "@/lib/permissions/taxonomy";
import { getPlanById, getSubscriptionForCompany } from "@/modules/billing/queries";
import {
  clampModulesToPlan,
  parseEnabledModules,
  parsePlanModules,
  type EnabledModules,
  type FeatureModule,
} from "./feature-catalog";
import {
  applyModuleFieldVisibility,
  parseAssetFieldConfig,
  parseDashboardLayouts,
  parseDashboardWidgets,
  parseStringCatalog,
  parseWorkflowConfig,
  type AssetFieldConfig,
  type DashboardLayouts,
  type DashboardWidgetConfig,
  type WorkflowConfig,
} from "./workspace-config";

export type { EnabledModules, FeatureModule } from "./feature-catalog";
export {
  DEFAULT_ENABLED_MODULES,
  FEATURE_MODULE_DESCRIPTIONS,
  FEATURE_MODULE_LABELS,
  FEATURE_MODULES,
  parseEnabledModules,
} from "./feature-catalog";

interface SettingsRow {
  enabled_modules: unknown;
  asset_field_config: unknown;
  dashboard_widgets: unknown;
  dashboard_layouts: unknown;
  workflow_config: unknown;
  department_catalog: unknown;
  disposal_methods: unknown;
}

export interface WorkspaceRuntime {
  modules: EnabledModules;
  fields: AssetFieldConfig;
  widgets: DashboardWidgetConfig;
  layouts: DashboardLayouts;
  workflows: WorkflowConfig;
  departments: string[];
  disposalMethods: string[];
  planModules: FeatureModule[] | null;
}

/**
 * Request-scoped subscription read. Module checks and the read-only billing
 * gate (tenant-access.ts) both need it on almost every page, so they share
 * one query per request.
 */
export const getCompanySubscription = cache(getSubscriptionForCompany);

/** Request-scoped plan read, shared by module checks and the asset quota. */
export const getCompanyPlan = cache(getPlanById);

const resolvePlanModules = cache(async (companyId: string): Promise<FeatureModule[] | null> => {
  const subscription = await getCompanySubscription(companyId);
  if (!subscription) {
    return null;
  }
  const plan = await getCompanyPlan(subscription.planId);
  return parsePlanModules(plan?.includedModules ?? null);
});

export async function resolveEnabledModulesForCompany(companyId: string): Promise<EnabledModules> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("company_settings")
    .select("enabled_modules")
    .eq("company_id", companyId)
    .maybeSingle<{ enabled_modules: unknown }>();
  const company = parseEnabledModules(data?.enabled_modules);
  const planModules = await resolvePlanModules(companyId);
  return clampModulesToPlan(company, planModules);
}

/** Plan entitlement ∩ company toggles, from the request's cached workspace runtime. */
export async function getEnabledModules(): Promise<EnabledModules> {
  return (await getWorkspaceRuntime()).modules;
}

/**
 * Memoized per request — module checks run dozens of times per page
 * (sidebar, dashboard widgets, guards), and each used to re-read
 * company_settings, the subscription and the plan.
 */
export const getWorkspaceRuntime = cache(async (): Promise<WorkspaceRuntime> => {
  const companyId = headers().get(TENANT_HEADERS.companyId);
  if (!companyId) {
    const modules = parseEnabledModules(null);
    return {
      modules,
      fields: applyModuleFieldVisibility(parseAssetFieldConfig(null), modules),
      widgets: parseDashboardWidgets(null),
      layouts: parseDashboardLayouts(null),
      workflows: parseWorkflowConfig(null),
      departments: [],
      disposalMethods: [],
      planModules: null,
    };
  }

  const supabase = createClient();
  const fullSelect =
    "enabled_modules, asset_field_config, dashboard_widgets, dashboard_layouts, workflow_config, department_catalog, disposal_methods";
  // Independent reads — fetch the plan alongside the settings row rather than after it.
  const [{ data, error }, planModules] = await Promise.all([
    supabase.from("company_settings").select(fullSelect).eq("company_id", companyId).maybeSingle<SettingsRow>(),
    resolvePlanModules(companyId),
  ]);

  const row: SettingsRow | null = data ?? null;
  if (error || !row) {
    const fallback = await supabase
      .from("company_settings")
      .select("enabled_modules, asset_field_config, dashboard_widgets, workflow_config, department_catalog, disposal_methods")
      .eq("company_id", companyId)
      .maybeSingle<Omit<SettingsRow, "dashboard_layouts">>();
    const modules = clampModulesToPlan(parseEnabledModules(fallback.data?.enabled_modules), planModules);
    return {
      modules,
      fields: applyModuleFieldVisibility(parseAssetFieldConfig(fallback.data?.asset_field_config), modules),
      widgets: parseDashboardWidgets(fallback.data?.dashboard_widgets),
      layouts: parseDashboardLayouts(null),
      workflows: parseWorkflowConfig(fallback.data?.workflow_config),
      departments: parseStringCatalog(fallback.data?.department_catalog),
      disposalMethods: parseStringCatalog(fallback.data?.disposal_methods),
      planModules,
    };
  }

  const modules = clampModulesToPlan(parseEnabledModules(row.enabled_modules), planModules);
  return {
    modules,
    fields: applyModuleFieldVisibility(parseAssetFieldConfig(data?.asset_field_config), modules),
    widgets: parseDashboardWidgets(data?.dashboard_widgets),
    layouts: parseDashboardLayouts(data?.dashboard_layouts),
    workflows: parseWorkflowConfig(data?.workflow_config),
    departments: parseStringCatalog(data?.department_catalog),
    disposalMethods: parseStringCatalog(data?.disposal_methods),
    planModules,
  };
});

/**
 * Tenant feature flags only. Super-admin RBAC bypass must not treat every
 * company module as enabled on `/dashboard` and `/floor`.
 */
export async function isModuleEnabled(module: FeatureModule): Promise<boolean> {
  const enabled = await getEnabledModules();
  return enabled[module];
}

/** Plan entitlement ∩ company-enabled modules. Company Admin does not bypass this. */
export async function requireModule(module: FeatureModule): Promise<boolean> {
  return isModuleEnabled(module);
}

export async function canAccess(
  feature: FeatureModule,
  module: PermissionModule,
  action: PermissionAction,
): Promise<boolean> {
  if (!(await requireModule(feature))) {
    return false;
  }
  return requirePermission(module, action);
}

/** Pages: send the caller home when the company has this module turned off. */
export async function assertModule(module: FeatureModule): Promise<void> {
  if (!(await requireModule(module))) {
    redirect("/dashboard");
  }
}
