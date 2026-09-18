"use server";

import "server-only";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { isValidTenantSlug, TENANT_HEADERS } from "@/lib/tenant";
import { clientIpFromHeaders, consumeRateLimit } from "@/lib/rate-limit";
import { isCurrentUserSuperAdmin } from "@/lib/permissions/super-admin";
import { requirePermission } from "@/lib/permissions/has-permission";
import { createClient } from "@/lib/supabase/server";
import { sendUserInviteEmail } from "@/lib/email";
import { createSystemAdminRole } from "@/modules/roles/mutations";
import { seedDefaultAssetStatuses } from "@/modules/statuses/mutations";
import { seedDefaultAssetConditions } from "@/modules/conditions/mutations";
import { uploadFileToR2 } from "@/modules/storage/mutations";
import { createCompanySchema, slugSchema, updateCompanyBrandingSchema, updateCompanySchema, updateWorkspaceSettingsSchema } from "./validation";
import { getCompanyBySlug, getCompanyById, getCompanyWorkspaceSettings, getUserIdsForCompany, listCompanies } from "./queries";
import { getPlanById, getSubscriptionForCompany } from "@/modules/billing/queries";
import { applyPlanLimitsToCompany, upsertCompanySubscription } from "@/modules/billing/mutations";
import {
  createCompany,
  createCompanyInvite,
  deleteAuthUsersByIds,
  deleteCompany,
  seedCompanyPlatformCatalogs,
  setCompanySuspended,
  updateCompany,
  updateCompanyBranding,
  upsertCompanyWorkspaceSettings,
} from "./mutations";
import type {
  CompanyBranding,
  CompanySummary,
  CompanyWorkspaceSettings,
  CreateCompanyState,
  DeleteCompanyState,
  UpdateCompanyBrandingState,
  UpdateCompanyState,
  UpdateWorkspaceSettingsState,
} from "./types";
import { FEATURE_MODULES, clampModulesToPlan, parseEnabledModules, parsePlanModules, type EnabledModules } from "@/lib/permissions/feature-catalog";
import {
  ASSET_FIELD_KEYS,
  DASHBOARD_WIDGET_KEYS,
  WORKFLOW_KEYS,
  parseAssetFieldConfig,
  parseCatalogText,
  parseDashboardWidgets,
  parseStringCatalog,
  parseWorkflowConfig,
} from "@/lib/permissions/workspace-config";
import { writeAuditLog } from "@/lib/audit-log";

/**
 * Controller entry point for rendering a tenant's login page. Validates
 * the slug shape before it ever reaches a query, then delegates to the
 * Model layer. Pages call this, never queries.ts directly.
 */
export async function getCompanyForLogin(slug: string): Promise<CompanyBranding | null> {
  const parsed = slugSchema.safeParse(slug);
  if (!parsed.success) {
    return null;
  }

  return getCompanyBySlug(parsed.data);
}

/** Landing /login: turn a workspace slug into /{slug}/login. */
export async function resolveWorkspaceLogin(
  raw: string,
): Promise<{ error: string } | { redirectPath: string }> {
  const ip = clientIpFromHeaders(headers());
  if (!consumeRateLimit(`workspace-login:${ip}`, 20, 60_000)) {
    return { error: "Try again later." };
  }

  const normalized = raw.trim().toLowerCase().replace(/^\/+|\/+$/g, "").replace(/\/login$/, "");
  const parsed = slugSchema.safeParse(normalized);
  if (!parsed.success || !isValidTenantSlug(parsed.data)) {
    return { error: "Enter your workspace URL, like acme." };
  }

  const company = await getCompanyBySlug(parsed.data);
  if (!company) {
    return { error: "We couldn't find that workspace." };
  }

  return { redirectPath: `/${parsed.data}/login` };
}

/**
 * The signed-in caller's own company, for rendering things like the
 * dashboard top bar. `company_id` comes from the x-company-id header
 * middleware.ts attaches after verifying the session — never from a
 * client-supplied value.
 */
export async function getCurrentCompany(): Promise<CompanyBranding | null> {
  const companyId = headers().get(TENANT_HEADERS.companyId);
  if (!companyId) {
    return null;
  }

  return getCompanyById(companyId);
}

/** Every company on the platform. Super-admin only — see /admin. */
export async function listCompaniesForAdmin(): Promise<CompanySummary[]> {
  if (!(await isCurrentUserSuperAdmin())) {
    return [];
  }

  return listCompanies();
}

/**
 * Creates the company, seeds its default full-permission "Admin" role,
 * and creates a one-time invite for the admin email given — then either
 * emails the setup link (production, real Brevo key) or hands the link
 * back directly (development, so testing never depends on Brevo — see
 * lib/email.ts's shouldSendReal()). Doesn't redirect: the caller needs to
 * see that link.
 */
export async function createCompanyAction(
  _prevState: CreateCompanyState,
  formData: FormData,
): Promise<CreateCompanyState> {
  if (!(await isCurrentUserSuperAdmin())) {
    return { error: "Not authorized." };
  }

  const parsed = createCompanySchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    isDedicatedInfra: formData.get("isDedicatedInfra") === "on",
    adminEmail: formData.get("adminEmail"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const planIdRaw = formData.get("planId");
  const planId = typeof planIdRaw === "string" && planIdRaw.length > 0 ? planIdRaw : null;
  const plan = planId ? await getPlanById(planId) : null;
  if (planId && !plan) {
    return { error: "Choose a valid plan." };
  }

  const companyResult = await createCompany(parsed.data);
  if ("error" in companyResult) {
    return { error: companyResult.error };
  }

  if (plan) {
    const subResult = await upsertCompanySubscription(companyResult.id, plan.id);
    if ("error" in subResult) {
      return { error: subResult.error };
    }
    const limits = await applyPlanLimitsToCompany(companyResult.id, plan);
    if ("error" in limits) {
      return { error: limits.error };
    }
  }

  const roleResult = await createSystemAdminRole(companyResult.id);
  if ("error" in roleResult) {
    return { error: roleResult.error };
  }

  const statusSeedResult = await seedDefaultAssetStatuses(companyResult.id);
  if (statusSeedResult.error) {
    return { error: statusSeedResult.error };
  }

  const conditionSeedResult = await seedDefaultAssetConditions(companyResult.id);
  if (conditionSeedResult.error) {
    return { error: conditionSeedResult.error };
  }

  const catalogSeedResult = await seedCompanyPlatformCatalogs(companyResult.id);
  if (catalogSeedResult.error) {
    return { error: catalogSeedResult.error };
  }

  const supabase = createClient();
  const {
    data: { user: currentSuperAdmin },
  } = await supabase.auth.getUser();

  const inviteResult = await createCompanyInvite(
    companyResult.id,
    roleResult.id,
    parsed.data.adminEmail,
    currentSuperAdmin?.id ?? null,
  );
  if ("error" in inviteResult) {
    return { error: inviteResult.error };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const inviteUrl = `${appUrl}/invite/${inviteResult.token}`;

  const emailResult = await sendUserInviteEmail({
    to: parsed.data.adminEmail,
    companyName: parsed.data.name,
    inviteUrl,
  });

  revalidatePath("/admin");

  const isProd = process.env.NODE_ENV === "production";
  const showLinkDirectly = !isProd || "error" in emailResult;

  return { error: null, inviteUrl: showLinkDirectly ? inviteUrl : undefined };
}

/**
 * Edits a company's name/dedicated-infra flag. Slug is never accepted here
 * (see updateCompanySchema) — it's baked into every tenant login/reset/
 * invite URL already issued, so it stays read-only after creation.
 */
export async function updateCompanyAction(
  companyId: string,
  _prevState: UpdateCompanyState,
  formData: FormData,
): Promise<UpdateCompanyState> {
  if (!(await isCurrentUserSuperAdmin())) {
    return { error: "Not authorized." };
  }

  const parsed = updateCompanySchema.safeParse({
    name: formData.get("name"),
    isDedicatedInfra: formData.get("isDedicatedInfra") === "on",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const result = await updateCompany(companyId, parsed.data);
  if ("error" in result) {
    return { error: result.error };
  }

  revalidatePath("/admin");

  return { error: null, success: true };
}

export async function setCompanySuspendedAction(
  companyId: string,
  suspended: boolean,
): Promise<UpdateCompanyState> {
  if (!(await isCurrentUserSuperAdmin())) {
    return { error: "Not authorized." };
  }
  const result = await setCompanySuspended(companyId, suspended);
  if ("error" in result) {
    return { error: result.error };
  }
  revalidatePath("/admin");
  return { error: null, success: true };
}

/**
 * Tenant admin's own Settings page — company name + branding only.
 * companyId always comes from the x-company-id header (never the form),
 * so a caller can never target another tenant's row even though the
 * schema itself accepts no id.
 */
export async function updateCompanyBrandingAction(
  _prevState: UpdateCompanyBrandingState,
  formData: FormData,
): Promise<UpdateCompanyBrandingState> {
  if (!(await requirePermission("settings", "edit"))) {
    return { error: "You don't have permission to edit settings." };
  }

  const companyId = headers().get(TENANT_HEADERS.companyId);
  if (!companyId) {
    return { error: "Could not determine your company." };
  }

  const parsed = updateCompanyBrandingSchema.safeParse({
    name: formData.get("name"),
    primaryColor: formData.get("primaryColor"),
    secondaryColor: formData.get("secondaryColor"),
    contactEmail: formData.get("contactEmail"),
    contactPhone: formData.get("contactPhone"),
    contactAddress: formData.get("contactAddress"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const current = await getCompanyById(companyId);
  let logoUrl = current?.logoUrl ?? null;

  const logoFile = formData.get("logo");
  if (logoFile instanceof File && logoFile.size > 0) {
    const uploadResult = await uploadFileToR2({ companyId, folder: "branding", file: logoFile });
    if ("error" in uploadResult) {
      return { error: uploadResult.error };
    }
    logoUrl = uploadResult.url;
  }

  const result = await updateCompanyBranding(companyId, {
    name: parsed.data.name,
    logoUrl,
    primaryColor: parsed.data.primaryColor,
    secondaryColor: parsed.data.secondaryColor,
    contactEmail: parsed.data.contactEmail ?? null,
    contactPhone: parsed.data.contactPhone ?? null,
    contactAddress: parsed.data.contactAddress ?? null,
  });
  if ("error" in result) {
    return { error: result.error };
  }

  revalidatePath("/dashboard/administration/settings");
  revalidatePath("/", "layout");
  if (current?.slug) {
    revalidatePath(`/${current.slug}/login`);
  }

  return { error: null, success: true };
}

export async function getWorkspaceSettingsForAdmin(): Promise<CompanyWorkspaceSettings | null> {
  if (!(await requirePermission("settings", "view"))) {
    return null;
  }
  const companyId = headers().get(TENANT_HEADERS.companyId);
  if (!companyId) {
    return null;
  }
  const settings = await getCompanyWorkspaceSettings(companyId);
  const subscription = await getSubscriptionForCompany(companyId);
  const plan = subscription ? await getPlanById(subscription.planId) : null;
  return {
    assetCodeFormat: settings.assetCodeFormat,
    enabledModules: parseEnabledModules(settings.enabledModules),
    planModules: parsePlanModules(plan?.includedModules ?? null),
    assetFieldConfig: parseAssetFieldConfig(settings.assetFieldConfig),
    dashboardWidgets: parseDashboardWidgets(settings.dashboardWidgets),
    workflowConfig: parseWorkflowConfig(settings.workflowConfig),
    departments: parseStringCatalog(settings.departmentCatalog),
    disposalMethods: parseStringCatalog(settings.disposalMethods),
  };
}

export async function updateWorkspaceSettingsAction(
  _prevState: UpdateWorkspaceSettingsState,
  formData: FormData,
): Promise<UpdateWorkspaceSettingsState> {
  if (!(await requirePermission("settings", "edit"))) {
    return { error: "You don't have permission to edit settings." };
  }
  const companyId = headers().get(TENANT_HEADERS.companyId);
  if (!companyId) {
    return { error: "Could not determine your company." };
  }

  const parsed = updateWorkspaceSettingsSchema.safeParse({
    assetCodeFormat: formData.get("assetCodeFormat"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const subscription = await getSubscriptionForCompany(companyId);
  const plan = subscription ? await getPlanById(subscription.planId) : null;
  const planModules = parsePlanModules(plan?.includedModules ?? null);
  const requested: EnabledModules = parseEnabledModules(null);
  for (const key of FEATURE_MODULES) {
    requested[key] = formData.get(`module_${key}`) === "on";
  }
  const enabledModules = clampModulesToPlan(requested, planModules);
  if (planModules) {
    for (const key of FEATURE_MODULES) {
      if (requested[key] && !planModules.includes(key)) {
        return { error: `${key} is not included in your plan.` };
      }
    }
  }

  const fieldConfig = parseAssetFieldConfig(null);
  for (const key of ASSET_FIELD_KEYS) {
    fieldConfig[key] = {
      enabled: formData.get(`field_enabled_${key}`) === "on",
      required: formData.get(`field_required_${key}`) === "on",
      label: String(formData.get(`field_label_${key}`) ?? "").trim() || fieldConfig[key].label,
      order: Number(formData.get(`field_order_${key}`) ?? fieldConfig[key].order) || fieldConfig[key].order,
    };
  }

  const widgets = parseDashboardWidgets(null);
  for (const key of DASHBOARD_WIDGET_KEYS) {
    widgets[key] = {
      enabled: formData.get(`widget_${key}`) === "on",
      order: Number(formData.get(`widget_order_${key}`) ?? widgets[key].order) || widgets[key].order,
    };
  }

  const workflows = parseWorkflowConfig(null);
  for (const key of WORKFLOW_KEYS) {
    workflows[key] = formData.get(`workflow_${key}`) === "on";
  }

  const result = await upsertCompanyWorkspaceSettings(companyId, {
    assetCodeFormat: parsed.data.assetCodeFormat,
    enabledModules,
    assetFieldConfig: fieldConfig,
    dashboardWidgets: widgets,
    workflowConfig: workflows,
    departmentCatalog: parseCatalogText(String(formData.get("departments") ?? "")),
    disposalMethods: parseCatalogText(String(formData.get("disposalMethods") ?? "")),
  });
  if (result.error) {
    return { error: result.error };
  }

  await writeAuditLog({
    action: "settings.updated",
    entityType: "company_settings",
    entityId: companyId,
    newValues: { assetCodeFormat: parsed.data.assetCodeFormat, enabledModules },
  });
  revalidatePath("/dashboard/administration/settings");
  revalidatePath("/", "layout");
  return { error: null, success: true };
}

/**
 * Deletes a company and everything under it. `company_id ... on delete
 * cascade` on every tenant table takes care of the data itself, but the
 * `auth.users` accounts that belonged to it are a separate system Postgres
 * cascades don't reach — collected here *before* the delete removes the
 * `public.users` rows that record who they were, then removed explicitly
 * so their emails are immediately free for a brand-new company.
 */
export async function deleteCompanyAction(companyId: string): Promise<DeleteCompanyState> {
  if (!(await isCurrentUserSuperAdmin())) {
    return { error: "Not authorized." };
  }

  const userIds = await getUserIdsForCompany(companyId);

  const result = await deleteCompany(companyId);
  if ("error" in result) {
    return { error: result.error };
  }

  if (userIds.length > 0) {
    await deleteAuthUsersByIds(userIds);
  }

  revalidatePath("/admin");

  return { error: null, success: true };
}
