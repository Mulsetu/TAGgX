"use server";

import "server-only";
import ExcelJS from "exceljs";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { isValidTenantSlug, TENANT_HEADERS } from "@/lib/tenant";
import { clientIpFromHeaders, consumeRateLimit } from "@/lib/rate-limit";
import { isCurrentUserSuperAdmin } from "@/lib/permissions/super-admin";
import { isCurrentUserCompanyAdmin, requirePermission } from "@/lib/permissions/has-permission";
import { createClient } from "@/lib/supabase/server";
import { sendUserInviteEmail, sendWorkspaceDeletionRequestEmail } from "@/lib/email";
import { getSiteUrl } from "@/lib/site";
import { createSystemAdminRole, seedDefaultCompanyRoles } from "@/modules/roles/mutations";
import { seedDefaultAssetStatuses } from "@/modules/statuses/mutations";
import { seedDefaultAssetConditions } from "@/modules/conditions/mutations";
import { uploadFileToR2 } from "@/modules/storage/mutations";
import { createCompanySchema, requestDeletionSchema, slugSchema, updateCompanyBrandingSchema, updateCompanySchema, updateWorkspaceSettingsSchema } from "./validation";
import { getCompanyBySlug, getCompanyById, getCompanyWorkspaceSettings, getUserIdsForCompany, getWorkspaceExportData, listCompanies } from "./queries";
import { getPlanById, getSubscriptionForCompany } from "@/modules/billing/queries";
import { applyPlanLimitsToCompany, insertBillingPayment, upsertCompanySubscription } from "@/modules/billing/mutations";
import {
  cancelCompanyDeletionRequest,
  createCompany,
  createCompanyInvite,
  deleteAuthUsersByIds,
  deleteCompany,
  requestCompanyDeletion,
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
  DeletionRequestState,
  UpdateCompanyBrandingState,
  UpdateCompanyState,
  UpdateWorkspaceSettingsState,
  WorkspaceExportSheet,
  WorkspaceExportState,
} from "./types";
import { FEATURE_MODULES, clampModulesToPlan, parseEnabledModules, parsePlanModules, type EnabledModules } from "@/lib/permissions/feature-catalog";
import {
  ASSET_FIELD_KEYS,
  DASHBOARD_WIDGET_KEYS,
  DASHBOARD_WIDGET_SIZES,
  WORKFLOW_KEYS,
  parseAssetFieldConfig,
  parseCatalogText,
  parseDashboardLayouts,
  parseDashboardWidgets,
  parseStringCatalog,
  parseWorkflowConfig,
  type DashboardLayouts,
  type DashboardWidgetConfig,
  type DashboardWidgetSize,
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
async function provisionCompanyWorkspace(companyId: string): Promise<{ error: string } | { adminRoleId: string }> {
  const roleResult = await createSystemAdminRole(companyId);
  if ("error" in roleResult) {
    return { error: roleResult.error };
  }
  const defaultRoles = await seedDefaultCompanyRoles(companyId);
  if (defaultRoles.error) {
    return { error: defaultRoles.error };
  }
  const statusSeedResult = await seedDefaultAssetStatuses(companyId);
  if (statusSeedResult.error) {
    return { error: statusSeedResult.error };
  }
  const conditionSeedResult = await seedDefaultAssetConditions(companyId);
  if (conditionSeedResult.error) {
    return { error: conditionSeedResult.error };
  }
  const catalogSeedResult = await seedCompanyPlatformCatalogs(companyId);
  if (catalogSeedResult.error) {
    return { error: catalogSeedResult.error };
  }
  return { adminRoleId: roleResult.id };
}

/**
 * Super-admin only. Creates the company, optional plan/subscription/payment,
 * then emails a setup invite. Does not set the customer's password.
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
    adminName: formData.get("adminName") || undefined,
    subscriptionType: formData.get("subscriptionType") || undefined,
    billingCycle: formData.get("billingCycle") || undefined,
    startsAt: formData.get("startsAt") || undefined,
    endsAt: formData.get("endsAt") || undefined,
    subscriptionStatus: formData.get("subscriptionStatus") || undefined,
    paymentMethod: formData.get("paymentMethod") || undefined,
    paymentAmount: formData.get("paymentAmount") || undefined,
    paymentStatus: formData.get("paymentStatus") || undefined,
    paymentReference: formData.get("paymentReference") || undefined,
    paymentDate: formData.get("paymentDate") || undefined,
    paymentNotes: formData.get("paymentNotes") || undefined,
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

  const provisioned = await provisionCompanyWorkspace(companyResult.id);
  if ("error" in provisioned) {
    return { error: provisioned.error };
  }

  const subscriptionType = parsed.data.subscriptionType ?? "sales_assisted";
  const skipPayment =
    subscriptionType === "demo" || subscriptionType === "complimentary" || subscriptionType === "trial";
  const defaultStatus =
    parsed.data.subscriptionStatus ??
    (skipPayment || parsed.data.paymentStatus === "paid" ? "active" : plan && plan.priceMonthly > 0 ? "pending_payment" : "active");

  if (plan) {
    const subResult = await upsertCompanySubscription(companyResult.id, plan.id, {
      status: defaultStatus,
      subscriptionType,
      billingCycle: parsed.data.billingCycle ?? "monthly",
      startsAt: parsed.data.startsAt || undefined,
      endsAt: parsed.data.endsAt || null,
    });
    if ("error" in subResult) {
      return { error: subResult.error };
    }
    const limits = await applyPlanLimitsToCompany(companyResult.id, plan);
    if ("error" in limits) {
      return { error: limits.error };
    }

    if (!skipPayment && parsed.data.paymentMethod && (parsed.data.paymentAmount ?? 0) > 0 && parsed.data.paymentStatus) {
      const subscription = await getSubscriptionForCompany(companyResult.id);
      const supabase = createClient();
      const {
        data: { user: actor },
      } = await supabase.auth.getUser();
      const payment = await insertBillingPayment({
        companyId: companyResult.id,
        subscriptionId: subscription?.id ?? null,
        amount: parsed.data.paymentAmount ?? 0,
        currency: plan.currency,
        paymentMethod: parsed.data.paymentMethod,
        paymentStatus: parsed.data.paymentStatus,
        referenceNumber: parsed.data.paymentReference ?? null,
        paymentDate: parsed.data.paymentDate || new Date().toISOString().slice(0, 10),
        notes: parsed.data.paymentNotes ?? null,
        createdBy: actor?.id ?? null,
      });
      if ("error" in payment) {
        return { error: payment.error };
      }
    }
  }

  await writeAuditLog({
    action: "company.created",
    entityType: "company",
    entityId: companyResult.id,
    companyId: companyResult.id,
    newValues: { slug: parsed.data.slug, planId, subscriptionType, status: defaultStatus },
  });

  const supabase = createClient();
  const {
    data: { user: currentSuperAdmin },
  } = await supabase.auth.getUser();

  const inviteResult = await createCompanyInvite(
    companyResult.id,
    provisioned.adminRoleId,
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

  await writeAuditLog({
    action: "user.invited",
    entityType: "company_invite",
    entityId: inviteResult.token ? undefined : null,
    companyId: companyResult.id,
    newValues: { email: parsed.data.adminEmail },
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
    dashboardLayouts: parseDashboardLayouts(settings.dashboardLayouts),
    workflowConfig: parseWorkflowConfig(settings.workflowConfig),
    departments: parseStringCatalog(settings.departmentCatalog),
    disposalMethods: parseStringCatalog(settings.disposalMethods),
  };
}

function parseWidgetSize(value: FormDataEntryValue | null, fallback: DashboardWidgetSize): DashboardWidgetSize {
  return DASHBOARD_WIDGET_SIZES.includes(value as DashboardWidgetSize)
    ? (value as DashboardWidgetSize)
    : fallback;
}

function widgetsFromForm(formData: FormData, prefix: string, defaults: DashboardWidgetConfig): DashboardWidgetConfig {
  const widgets = parseDashboardWidgets(defaults);
  for (const key of DASHBOARD_WIDGET_KEYS) {
    widgets[key] = {
      enabled: formData.get(`${prefix}${key}`) === "on",
      order: Number(formData.get(`${prefix}order_${key}`) ?? widgets[key].order) || widgets[key].order,
      size: parseWidgetSize(formData.get(`${prefix}size_${key}`), widgets[key].size),
    };
  }
  return widgets;
}

const ROLE_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function layoutsFromForm(formData: FormData): DashboardLayouts {
  const roleIds = String(formData.get("layoutRoleIds") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter((id) => ROLE_ID_RE.test(id));
  const roles: DashboardLayouts["roles"] = {};
  for (const roleId of roleIds) {
    if (formData.get(`role_layout_on_${roleId}`) !== "on") {
      continue;
    }
    roles[roleId] = widgetsFromForm(formData, `role_${roleId}_widget_`, parseDashboardWidgets(null));
  }
  return { roles };
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

  const resetDashboard = formData.get("resetDashboard") === "1";
  const widgets = resetDashboard
    ? parseDashboardWidgets(null)
    : widgetsFromForm(formData, "widget_", parseDashboardWidgets(null));
  const layouts = resetDashboard ? parseDashboardLayouts(null) : layoutsFromForm(formData);

  const workflows = parseWorkflowConfig(null);
  for (const key of WORKFLOW_KEYS) {
    workflows[key] = formData.get(`workflow_${key}`) === "on";
  }

  const result = await upsertCompanyWorkspaceSettings(companyId, {
    assetCodeFormat: parsed.data.assetCodeFormat,
    enabledModules,
    assetFieldConfig: fieldConfig,
    dashboardWidgets: widgets,
    dashboardLayouts: layouts,
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
  revalidatePath("/dashboard");
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

async function sheetsToXlsxBase64(sheets: WorkspaceExportSheet[]): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  for (const sheet of sheets) {
    // Sheet names can't exceed 31 chars or contain [ ] : * ? / \ — every
    // name here is a short literal already within that limit, so no
    // sanitizing needed, just the length guard for safety.
    const worksheet = workbook.addWorksheet(sheet.name.slice(0, 31));
    worksheet.addRow(sheet.columns);
    for (const row of sheet.rows) {
      worksheet.addRow(row);
    }
  }
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  return buffer.toString("base64");
}

/**
 * Settings > "Export my data": a Company Admin's self-serve copy of
 * everything RLS already scopes to their company — assets, locations,
 * categories, maintenance, vendors, users, and the audit trail — as one
 * downloadable workbook. Company-Admin-gated rather than a permission
 * cell: this is workspace-owner territory, same reasoning as the
 * deletion-request actions below.
 */
export async function exportWorkspaceDataAction(): Promise<WorkspaceExportState> {
  if (!(await isCurrentUserCompanyAdmin()) && !(await isCurrentUserSuperAdmin())) {
    return { error: "Only a Company Admin can export workspace data." };
  }

  const exportKey = `workspace-export:${clientIpFromHeaders(headers())}`;
  if (!consumeRateLimit(exportKey, 5, 60 * 60 * 1000)) {
    return { error: "Too many exports. Try again later." };
  }

  const company = await getCurrentCompany();
  if (!company) {
    return { error: "Could not determine your company." };
  }

  const sheets = await getWorkspaceExportData();
  const stamp = new Date().toISOString().slice(0, 10);

  await writeAuditLog({ action: "company.data_exported", entityType: "company", entityId: company.id });

  return {
    error: null,
    export: {
      filename: `${company.slug}-export-${stamp}.xlsx`,
      content: await sheetsToXlsxBase64(sheets),
      mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      encoding: "base64",
    },
  };
}

/**
 * Settings > "Danger zone" > request deletion. Only flags the company —
 * see request_company_deletion() (migration 0050) and
 * sendWorkspaceDeletionRequestEmail's doc comment for why this isn't a
 * one-click hard delete. Requires typing the workspace slug, same
 * confirm-by-typing pattern the super-admin delete flow already uses in
 * company-detail-dialog.tsx.
 */
export async function requestWorkspaceDeletionAction(
  _prevState: DeletionRequestState,
  formData: FormData,
): Promise<DeletionRequestState> {
  if (!(await isCurrentUserCompanyAdmin())) {
    return { error: "Only a Company Admin can request workspace deletion." };
  }

  const company = await getCurrentCompany();
  if (!company) {
    return { error: "Could not determine your company." };
  }

  const parsed = requestDeletionSchema.safeParse({
    reason: formData.get("reason"),
    confirmSlug: formData.get("confirmSlug"),
  });
  if (!parsed.success || parsed.data.confirmSlug !== company.slug) {
    return { error: `Type "${company.slug}" to confirm.` };
  }

  const deletionKey = `deletion-request:${company.id}`;
  if (!consumeRateLimit(deletionKey, 3, 24 * 60 * 60 * 1000)) {
    return { error: "Too many requests. Contact TagX support directly." };
  }

  const result = await requestCompanyDeletion(parsed.data.reason ?? null);
  if (result.error) {
    return { error: result.error };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await writeAuditLog({
    action: "company.deletion_requested",
    entityType: "company",
    entityId: company.id,
    newValues: { reason: parsed.data.reason ?? null },
  });

  // Best-effort: the request is already recorded on `companies` either
  // way (visible in the admin companies list), so a failed notification
  // email shouldn't block the confirmation the Company Admin sees.
  await sendWorkspaceDeletionRequestEmail({
    companyName: company.name,
    companySlug: company.slug,
    requestedByEmail: user?.email ?? "unknown",
    reason: parsed.data.reason ?? null,
    adminUrl: `${getSiteUrl()}/admin`,
  });

  revalidatePath("/dashboard/administration/settings");

  return { error: null, success: true };
}

export async function cancelWorkspaceDeletionRequestAction(): Promise<DeletionRequestState> {
  if (!(await isCurrentUserCompanyAdmin())) {
    return { error: "Only a Company Admin can cancel a deletion request." };
  }

  const result = await cancelCompanyDeletionRequest();
  if (result.error) {
    return { error: result.error };
  }

  const company = await getCurrentCompany();
  await writeAuditLog({ action: "company.deletion_request_canceled", entityType: "company", entityId: company?.id });

  revalidatePath("/dashboard/administration/settings");

  return { error: null, success: true };
}
