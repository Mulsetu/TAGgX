import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { TENANT_HEADERS } from "@/lib/tenant";
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
  parseDashboardWidgets,
  parseStringCatalog,
  parseWorkflowConfig,
  type AssetFieldConfig,
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
  workflow_config: unknown;
  department_catalog: unknown;
  disposal_methods: unknown;
}

export interface WorkspaceRuntime {
  modules: EnabledModules;
  fields: AssetFieldConfig;
  widgets: DashboardWidgetConfig;
  workflows: WorkflowConfig;
  departments: string[];
  disposalMethods: string[];
  planModules: FeatureModule[] | null;
}

async function resolvePlanModules(companyId: string): Promise<FeatureModule[] | null> {
  const subscription = await getSubscriptionForCompany(companyId);
  if (!subscription) {
    return null;
  }
  const plan = await getPlanById(subscription.planId);
  return parsePlanModules(plan?.includedModules ?? null);
}

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

export async function getEnabledModules(): Promise<EnabledModules> {
  const companyId = headers().get(TENANT_HEADERS.companyId);
  if (!companyId) {
    return parseEnabledModules(null);
  }

  const supabase = createClient();
  const { data } = await supabase
    .from("company_settings")
    .select("enabled_modules")
    .eq("company_id", companyId)
    .maybeSingle<{ enabled_modules: unknown }>();

  const company = parseEnabledModules(data?.enabled_modules);
  const planModules = await resolvePlanModules(companyId);
  return clampModulesToPlan(company, planModules);
}

export async function getWorkspaceRuntime(): Promise<WorkspaceRuntime> {
  const companyId = headers().get(TENANT_HEADERS.companyId);
  if (!companyId) {
    const modules = parseEnabledModules(null);
    return {
      modules,
      fields: applyModuleFieldVisibility(parseAssetFieldConfig(null), modules),
      widgets: parseDashboardWidgets(null),
      workflows: parseWorkflowConfig(null),
      departments: [],
      disposalMethods: [],
      planModules: null,
    };
  }

  const supabase = createClient();
  const { data } = await supabase
    .from("company_settings")
    .select("enabled_modules, asset_field_config, dashboard_widgets, workflow_config, department_catalog, disposal_methods")
    .eq("company_id", companyId)
    .maybeSingle<SettingsRow>();

  const planModules = await resolvePlanModules(companyId);
  const modules = clampModulesToPlan(parseEnabledModules(data?.enabled_modules), planModules);
  return {
    modules,
    fields: applyModuleFieldVisibility(parseAssetFieldConfig(data?.asset_field_config), modules),
    widgets: parseDashboardWidgets(data?.dashboard_widgets),
    workflows: parseWorkflowConfig(data?.workflow_config),
    departments: parseStringCatalog(data?.department_catalog),
    disposalMethods: parseStringCatalog(data?.disposal_methods),
    planModules,
  };
}

/**
 * Tenant feature flags only. Super-admin RBAC bypass must not treat every
 * company module as enabled on `/dashboard` and `/floor`.
 */
export async function isModuleEnabled(module: FeatureModule): Promise<boolean> {
  const enabled = await getEnabledModules();
  return enabled[module];
}

export async function requireModule(module: FeatureModule): Promise<boolean> {
  return isModuleEnabled(module);
}

/** Pages: send the caller home when the company has this module turned off. */
export async function assertModule(module: FeatureModule): Promise<void> {
  if (!(await requireModule(module))) {
    redirect("/dashboard");
  }
}
