"use server";

import "server-only";
import type { ZodError } from "zod";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { TENANT_HEADERS } from "@/lib/tenant";
import { clientIpFromHeaders, consumeRateLimit } from "@/lib/rate-limit";
import { requirePermission } from "@/lib/permissions/has-permission";
import { getWorkspaceRuntime, requireModule } from "@/lib/permissions/features";
import { ASSET_FIELD_KEYS, parseAssetFieldConfig } from "@/lib/permissions/workspace-config";
import { TENANT_READ_ONLY_MESSAGE, requireWritableTenant } from "@/lib/permissions/tenant-access";
import { isCurrentUserSuperAdmin } from "@/lib/permissions/super-admin";
import {
  getAssetAttachments,
  getAssetById,
  getAssetCountsByCategory,
  getAssetCountsByLocation,
  getAssetCountsByStatus,
  getAssetDocumentById,
  getAssetFilterOptions,
  getAssetFormOptions,
  getPublicAssetById,
  listAssetLocationHistory,
  listAssets,
  listChildAssets,
  listDocumentTypes,
  listMissingRequiredDocuments,
} from "./queries";
import {
  createAsset,
  createAssetDocument,
  deleteAsset,
  deleteAssetDocument,
  generateAssetCode,
  insertQrEvent,
  markQrGenerated,
  recordAssetLocationMove,
  restoreAsset,
  setAssetArchived,
  updateAsset,
} from "./mutations";
import { writeAuditLog } from "@/lib/audit-log";
import { createPublicTicket } from "@/modules/maintenance/mutations";
import { countRecentPublicReports } from "@/modules/maintenance/queries";
import { getUserWithRole } from "@/modules/users/queries";
import { deleteFilesFromR2, uploadFileToR2 } from "@/modules/storage/mutations";
import { assetFormSchema, assetListQuerySchema, publicAssetIdSchema, publicAssetReportSchema } from "./validation";
import { getCategoryFieldsForAssetForm, getCategoryFieldsForCategory, getCategoryPrefixForAsset } from "@/modules/categories/actions";
import { getVendorOptions } from "@/modules/vendors/actions";
import { getVendorById } from "@/modules/vendors/queries";
import { getLocationPath } from "@/modules/locations/actions";
import { assertCanCreateAsset } from "@/modules/billing/actions";
import { parseCategoryFieldValues } from "@/modules/categories/validation";
import type { CustomFieldValue } from "@/modules/categories/types";
import type {
  Asset,
  AssetAttachment,
  AssetFormOptions,
  AssetFormState,
  AssetListResult,
  AssetLocationMove,
  CategoryAssetCount,
  DeleteAssetState,
  LocationAssetCount,
  PublicAsset,
  PublicAssetReportState,
  StatusAssetCount,
  TagPageViewer,
} from "./types";

const EMPTY_ASSET_LIST: AssetListResult = { items: [], totalCount: 0, page: 1, pageSize: 25 };

const EMPTY_ASSET_FORM_OPTIONS: AssetFormOptions = {
  categories: [],
  locations: [],
  statuses: [],
  users: [],
  linkableAssets: [],
  categoryFields: [],
  conditions: [],
  vendors: [],
  fieldConfig: parseAssetFieldConfig(null),
  departments: [],
  disposalMethods: [],
};

function getCompanyIdFromHeaders(): string | null {
  return headers().get(TENANT_HEADERS.companyId);
}

/** For the dashboard's "assets by category" chart. */
export async function getAssetCountsByCategoryForDashboard(): Promise<CategoryAssetCount[]> {
  if (!(await requirePermission("assets", "view"))) {
    return [];
  }
  return getAssetCountsByCategory();
}

/** For the dashboard's "assets by status" chart. */
export async function getAssetCountsByStatusForDashboard(): Promise<StatusAssetCount[]> {
  if (!(await requirePermission("assets", "view"))) {
    return [];
  }
  return getAssetCountsByStatus();
}

/** For the dashboard's "assets by location" chart. */
export async function getAssetCountsByLocationForDashboard(): Promise<LocationAssetCount[]> {
  if (!(await requirePermission("assets", "view"))) {
    return [];
  }
  return getAssetCountsByLocation();
}

/** For /assets — parses raw (untrusted) URL search params before querying. */
export async function getAssetsForList(
  rawSearchParams: Record<string, string | string[] | undefined>,
): Promise<AssetListResult> {
  if (!(await requireModule("assets")) || !(await requirePermission("assets", "view"))) {
    return EMPTY_ASSET_LIST;
  }

  const parsed = assetListQuerySchema.safeParse({
    page: rawSearchParams.page,
    q: rawSearchParams.q,
    categoryId: rawSearchParams.category,
    locationId: rawSearchParams.location,
    statusId: rawSearchParams.status,
    vendorId: rawSearchParams.vendor,
    allottedTo: rawSearchParams.custodian,
    condition: rawSearchParams.condition,
    warranty: rawSearchParams.warranty,
    amc: rawSearchParams.amc,
    documentExpiry: rawSearchParams.docs,
    sort: rawSearchParams.sort,
    sortDir: rawSearchParams.dir,
    includeArchived: rawSearchParams.archived,
  });

  if (!parsed.success) {
    return listAssets({}, 1, 25);
  }

  const { page, ...filters } = parsed.data;
  return listAssets(filters, page, 25);
}

/** For /assets/[id] — the page calls this, never queries.ts directly. */
export async function getAssetDetail(id: string): Promise<Asset | null> {
  if (!(await requirePermission("assets", "view"))) {
    return null;
  }
  return getAssetById(id);
}

export async function getMissingRequiredDocumentsForAsset(assetId: string): Promise<{ key: string; name: string }[]> {
  if (!(await requirePermission("assets", "view"))) {
    return [];
  }
  return listMissingRequiredDocuments(assetId);
}

export async function getAssetLocationHistoryForDetail(assetId: string): Promise<AssetLocationMove[]> {
  if (!(await requirePermission("assets", "view"))) {
    return [];
  }
  return listAssetLocationHistory(assetId);
}

/** Public QR tag page — identification only, works with no session. */
export async function getPublicAssetForTag(id: string): Promise<PublicAsset | null> {
  const parsed = publicAssetIdSchema.safeParse(id);
  if (!parsed.success) {
    return null;
  }

  return getPublicAssetById(parsed.data);
}

/**
 * Who is looking at /tag/[id], so the page can offer sign-in vs "open in
 * TagX" without ever granting a super admin the company workspace.
 */
export async function getTagPageViewer(companyId: string): Promise<TagPageViewer> {
  if (await isCurrentUserSuperAdmin()) {
    return { kind: "superadmin" };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { kind: "anonymous" };
  }

  const profile = await getUserWithRole(user.id);
  if (!profile) {
    return { kind: "anonymous" };
  }

  if (profile.companyId !== companyId) {
    return { kind: "other" };
  }

  return { kind: "member", canOpenAsset: await requirePermission("assets", "view") };
}

/** Super admins don't get a company's workspace via an asset URL — send them to the public tag. */
export async function shouldRedirectAssetToTag(assetCompanyId: string): Promise<boolean> {
  if (!(await isCurrentUserSuperAdmin())) {
    return false;
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return true;
  }

  const profile = await getUserWithRole(user.id);
  return profile?.companyId !== assetCompanyId;
}

const PUBLIC_REPORT_WINDOW_MS = 15 * 60 * 1000;
const PUBLIC_REPORT_MAX_PER_WINDOW = 3;

/** Anonymous (or any) scanner filing a report from the QR tag page. */
export async function submitPublicAssetReportAction(
  _prevState: PublicAssetReportState,
  formData: FormData,
): Promise<PublicAssetReportState> {
  const parsed = publicAssetReportSchema.safeParse({
    assetId: formData.get("assetId"),
    name: formData.get("name"),
    email: formData.get("email"),
    message: formData.get("message"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }

  const asset = await getPublicAssetById(parsed.data.assetId);
  if (!asset) {
    return { error: "This asset could not be found." };
  }

  const email = parsed.data.email.toLowerCase();
  const ip = clientIpFromHeaders(headers());
  if (!consumeRateLimit(`public-report:${ip}`, 5, PUBLIC_REPORT_WINDOW_MS)) {
    return { error: "Too many reports from this network. Try again in a few minutes." };
  }

  const since = new Date(Date.now() - PUBLIC_REPORT_WINDOW_MS).toISOString();
  const recent = await countRecentPublicReports(asset.id, email, since);
  if (recent === null || recent >= PUBLIC_REPORT_MAX_PER_WINDOW) {
    return { error: "Too many reports from this email. Try again in a few minutes." };
  }

  const result = await createPublicTicket({
    companyId: asset.company.id,
    assetId: asset.id,
    title: `QR report from ${parsed.data.name}`,
    description: parsed.data.message,
    reporterName: parsed.data.name,
    reporterEmail: email,
  });
  if ("error" in result) {
    return { error: result.error };
  }

  revalidatePath("/dashboard/administration/maintenance");
  return { error: null, success: true };
}

/** Dropdown options for /assets/new and /assets/[id]'s edit form. */
export async function getAssetFormOptionsForForm(excludeAssetId?: string): Promise<AssetFormOptions> {
  const canRead =
    (await requirePermission("assets", "view")) ||
    (await requirePermission("assets", "create")) ||
    (await requirePermission("maintenance", "view"));
  if (!canRead) {
    return EMPTY_ASSET_FORM_OPTIONS;
  }
  const [options, categoryFields, vendors, runtime] = await Promise.all([
    getAssetFormOptions(excludeAssetId),
    getCategoryFieldsForAssetForm(),
    getVendorOptions(),
    getWorkspaceRuntime(),
  ]);
  return {
    ...options,
    categoryFields,
    vendors: vendors.map((vendor) => ({ id: vendor.id, name: vendor.name })),
    fieldConfig: runtime.fields,
    departments: runtime.departments,
    disposalMethods: runtime.disposalMethods,
  };
}

/** Category/location options for the /assets list page's filter bar. */
export async function getAssetFilterOptionsForList() {
  if (!(await requirePermission("assets", "view"))) {
    return { categories: [], locations: [], statuses: [], vendors: [], users: [], conditions: [] };
  }
  return getAssetFilterOptions();
}

export async function getChildAssetsForDetail(parentAssetId: string): Promise<import("./types").AssetOption[]> {
  if (!(await requirePermission("assets", "view"))) {
    return [];
  }
  return listChildAssets(parentAssetId);
}

/**
 * Confirms an id was actually returned by an RLS-scoped SELECT — i.e. it
 * belongs to the caller's own company — before it's allowed into a
 * category_id/location_id/linked_asset_id/allotted_to column. Options
 * populated via getAssetFormOptions() are already scoped this way, but a
 * submitted id could have been tampered with client-side; this re-checks
 * server-side rather than trusting it.
 */
async function belongsToCaller(
  table: "asset_categories" | "locations" | "asset_statuses" | "assets" | "users" | "vendors",
  id: string,
) {
  const supabase = createClient();
  const { data } = await supabase.from(table).select("id").eq("id", id).maybeSingle();
  return data !== null;
}

async function validateCrossTenantReferences(input: {
  categoryId: string;
  locationId: string;
  statusId: string;
  linkedAssetId?: string;
  allottedTo?: string;
  vendorId?: string;
  parentAssetId?: string;
  currentAssetId?: string;
}): Promise<string | null> {
  const [categoryOk, locationOk, statusOk] = await Promise.all([
    belongsToCaller("asset_categories", input.categoryId),
    belongsToCaller("locations", input.locationId),
    belongsToCaller("asset_statuses", input.statusId),
  ]);
  if (!categoryOk) return "Category not found.";
  if (!locationOk) return "Location not found.";
  if (!statusOk) return "Status not found.";

  if (input.linkedAssetId && !(await belongsToCaller("assets", input.linkedAssetId))) {
    return "Linked asset not found.";
  }
  if (input.allottedTo && !(await belongsToCaller("users", input.allottedTo))) {
    return "Allotted-to user not found.";
  }
  if (input.vendorId && !(await belongsToCaller("vendors", input.vendorId))) {
    return "Vendor not found.";
  }
  if (input.parentAssetId) {
    if (input.currentAssetId && input.parentAssetId === input.currentAssetId) {
      return "An asset cannot be its own parent.";
    }
    if (!(await belongsToCaller("assets", input.parentAssetId))) {
      return "Parent asset not found.";
    }
  }
  return null;
}

async function resolveCustomFields(
  categoryId: string,
  formData: FormData,
  existing: Record<string, CustomFieldValue>,
): Promise<{ values: Record<string, CustomFieldValue>; fieldErrors?: Record<string, string> }> {
  const fields = await getCategoryFieldsForCategory(categoryId);
  const parsed = parseCategoryFieldValues(fields, formData);
  if (Object.keys(parsed.fieldErrors).length > 0) {
    return { values: {}, fieldErrors: parsed.fieldErrors };
  }

  const merged: Record<string, CustomFieldValue> = { ...existing };
  for (const field of fields) {
    delete merged[field.key];
  }
  return { values: { ...merged, ...parsed.values } };
}

async function withVendorName(input: import("./validation").AssetFormInput): Promise<import("./validation").AssetFormInput> {
  if (!input.vendorId) {
    return { ...input, vendor: undefined };
  }
  const vendor = await getVendorById(input.vendorId);
  return { ...input, vendor: vendor?.name };
}

function readAssetFormData(formData: FormData) {
  return {
    name: formData.get("name"),
    imageUrl: formData.get("imageUrl"),
    assetCode: formData.get("assetCode"),
    categoryId: formData.get("categoryId"),
    locationId: formData.get("locationId"),
    cwipInvoiceId: formData.get("cwipInvoiceId"),
    statusId: formData.get("statusId"),
    condition: formData.get("condition"),
    brand: formData.get("brand"),
    model: formData.get("model"),
    linkedAssetId: formData.get("linkedAssetId"),
    description: formData.get("description"),
    serialNumber: formData.get("serialNumber"),
    vendorId: formData.get("vendorId"),
    vendor: formData.get("vendor"),
    poNumber: formData.get("poNumber"),
    invoiceDate: formData.get("invoiceDate"),
    invoiceNumber: formData.get("invoiceNumber"),
    purchaseDate: formData.get("purchaseDate"),
    purchasePrice: formData.get("purchasePrice"),
    ownershipType: formData.get("ownershipType"),
    partnerName: formData.get("partnerName"),
    allottedTo: formData.get("allottedTo"),
    allotmentDate: formData.get("allotmentDate"),
    warrantyStartDate: formData.get("warrantyStartDate"),
    warrantyEndDate: formData.get("warrantyEndDate"),
    amcProvider: formData.get("amcProvider"),
    amcStartDate: formData.get("amcStartDate"),
    amcEndDate: formData.get("amcEndDate"),
    insuranceProvider: formData.get("insuranceProvider"),
    insurancePolicyNumber: formData.get("insurancePolicyNumber"),
    insuranceExpiryDate: formData.get("insuranceExpiryDate"),
    criticality: formData.get("criticality"),
    usefulLifeYears: formData.get("usefulLifeYears"),
    currentBookValue: formData.get("currentBookValue"),
    residualValue: formData.get("residualValue"),
    notes: formData.get("notes"),
    department: formData.get("department"),
    tags: formData.get("tags"),
    parentAssetId: formData.get("parentAssetId"),
  };
}

async function missingConfiguredFields(
  data: import("./validation").AssetFormInput,
): Promise<Record<string, string> | null> {
  const runtime = await getWorkspaceRuntime();
  const fieldErrors: Record<string, string> = {};
  for (const key of ASSET_FIELD_KEYS) {
    const field = runtime.fields[key];
    if (!field.enabled || !field.required) {
      continue;
    }
    const value = data[key];
    if (value === undefined || value === null || value === "") {
      fieldErrors[key] = `${field.label} is required.`;
    }
  }
  return Object.keys(fieldErrors).length > 0 ? fieldErrors : null;
}

/**
 * Uploads the "image" file field, if one was picked, and returns its URL —
 * done here (inside the mutating action, right before the DB write)
 * rather than eagerly on file-select, so a cancelled/abandoned form never
 * leaves an orphaned R2 object behind. `existingImageUrl` (the hidden
 * `imageUrl` passthrough field) is used unchanged when no new file was
 * chosen, e.g. editing other fields without touching the image.
 */
async function resolveImageUrl(
  companyId: string,
  formData: FormData,
  existingImageUrl: string | undefined,
): Promise<{ url: string | null; error?: string }> {
  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) {
    return { url: existingImageUrl ?? null };
  }

  const uploadResult = await uploadFileToR2({ companyId, folder: "images", file });
  if ("error" in uploadResult) {
    return { url: null, error: uploadResult.error };
  }

  return { url: uploadResult.url };
}

export async function createAssetAction(
  _prevState: AssetFormState,
  formData: FormData,
): Promise<AssetFormState> {
  if (!(await requireModule("assets")) || !(await requirePermission("assets", "create"))) {
    return { error: "You don't have permission to create assets." };
  }

  const companyId = getCompanyIdFromHeaders();
  if (!companyId) {
    return { error: "Could not determine your company." };
  }

  const quota = await assertCanCreateAsset();
  if ("error" in quota) {
    return { error: quota.error };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in." };
  }

  const parsed = assetFormSchema.safeParse(readAssetFormData(formData));
  if (!parsed.success) {
    return { error: "Check the highlighted fields.", fieldErrors: flattenIssues(parsed.error) };
  }

  const configuredErrors = await missingConfiguredFields(parsed.data);
  if (configuredErrors) {
    return { error: "Check the highlighted fields.", fieldErrors: configuredErrors };
  }

  const referenceError = await validateCrossTenantReferences(parsed.data);
  if (referenceError) {
    return { error: referenceError };
  }

  const input = await withVendorName(parsed.data);

  const imageResult = await resolveImageUrl(companyId, formData, input.imageUrl);
  if (imageResult.error) {
    return { error: imageResult.error };
  }

  const customResult = await resolveCustomFields(parsed.data.categoryId, formData, {});
  if (customResult.fieldErrors) {
    return { error: "Check the highlighted fields.", fieldErrors: customResult.fieldErrors };
  }

  const assetCode = parsed.data.assetCode ?? (await generateAssetCode(companyId, await getCategoryPrefixForAsset(parsed.data.categoryId)));

  const result = await createAsset({
    companyId,
    createdBy: user.id,
    assetCode,
    input: { ...input, imageUrl: imageResult.url ?? undefined },
    customFields: customResult.values,
  });

  if ("error" in result) {
    return { error: result.error };
  }

  await writeAuditLog({
    action: "asset.created",
    entityType: "asset",
    entityId: result.id,
    newValues: { name: input.name, assetCode },
  });

  await recordAssetLocationMove({
    companyId,
    assetId: result.id,
    userId: user.id,
    fromLocationId: null,
    toLocationId: parsed.data.locationId,
    fromLocationPath: null,
    toLocationPath: await getLocationPath(parsed.data.locationId),
  });

  revalidatePath("/assets");
  redirect(`/assets/${result.id}`);
}

export async function updateAssetAction(
  id: string,
  _prevState: AssetFormState,
  formData: FormData,
): Promise<AssetFormState> {
  if (!(await requireWritableTenant())) {
    return { error: TENANT_READ_ONLY_MESSAGE };
  }
  if (!(await requireModule("assets")) || !(await requirePermission("assets", "edit"))) {
    return { error: "You don't have permission to edit assets." };
  }

  const companyId = getCompanyIdFromHeaders();
  if (!companyId) {
    return { error: "Could not determine your company." };
  }

  const parsed = assetFormSchema.safeParse(readAssetFormData(formData));
  if (!parsed.success) {
    return { error: "Check the highlighted fields.", fieldErrors: flattenIssues(parsed.error) };
  }

  const configuredErrors = await missingConfiguredFields(parsed.data);
  if (configuredErrors) {
    return { error: "Check the highlighted fields.", fieldErrors: configuredErrors };
  }

  const referenceError = await validateCrossTenantReferences({ ...parsed.data, currentAssetId: id });
  if (referenceError) {
    return { error: referenceError };
  }

  const input = await withVendorName(parsed.data);

  const imageResult = await resolveImageUrl(companyId, formData, input.imageUrl);
  if (imageResult.error) {
    return { error: imageResult.error };
  }

  const existing = await getAssetById(id);
  if (!existing) {
    return { error: "Asset not found." };
  }

  const customResult = await resolveCustomFields(parsed.data.categoryId, formData, existing.customFields);
  if (customResult.fieldErrors) {
    return { error: "Check the highlighted fields.", fieldErrors: customResult.fieldErrors };
  }

  const assetCode = parsed.data.assetCode ?? "";
  if (!assetCode) {
    return { error: "Asset code is required.", fieldErrors: { assetCode: "Required" } };
  }

  const result = await updateAsset(id, assetCode, { ...input, imageUrl: imageResult.url ?? undefined }, customResult.values);
  if ("error" in result) {
    return { error: result.error };
  }

  await writeAuditLog({
    action: "asset.updated",
    entityType: "asset",
    entityId: id,
    oldValues: { name: existing.name, locationId: existing.locationId },
    newValues: { name: input.name, locationId: parsed.data.locationId },
  });

  if (existing.locationId !== parsed.data.locationId) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const [fromPath, toPath] = await Promise.all([
        existing.locationId ? getLocationPath(existing.locationId) : Promise.resolve(existing.locationName),
        getLocationPath(parsed.data.locationId),
      ]);
      await recordAssetLocationMove({
        companyId,
        assetId: id,
        userId: user.id,
        fromLocationId: existing.locationId,
        toLocationId: parsed.data.locationId,
        fromLocationPath: fromPath ?? existing.locationName,
        toLocationPath: toPath,
      });
    }
  }

  revalidatePath("/assets");
  revalidatePath(`/assets/${id}`);
  redirect(`/assets/${id}`);
}

/** Records that a QR tag has been generated so the detail page can show it again. */
export async function markQrGeneratedAction(assetId: string): Promise<{ error: string | null }> {
  if (!(await requireWritableTenant())) {
    return { error: TENANT_READ_ONLY_MESSAGE };
  }
  if (!(await requireModule("qr")) || !(await requirePermission("assets", "edit"))) {
    return { error: "You don't have permission to generate a QR tag." };
  }

  const asset = await getAssetById(assetId);
  if (!asset) {
    return { error: "Asset not found." };
  }

  const result = await markQrGenerated(assetId);
  if (result.error) {
    return result;
  }

  const companyId = getCompanyIdFromHeaders();
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (companyId) {
    await insertQrEvent({
      companyId,
      assetId,
      eventType: asset.qrGeneratedAt ? "regenerated" : "generated",
      actorId: user?.id ?? null,
    });
  }
  await writeAuditLog({
    action: asset.qrGeneratedAt ? "asset.qr_regenerated" : "asset.qr_generated",
    entityType: "asset",
    entityId: assetId,
  });

  revalidatePath(`/assets/${assetId}`);
  return { error: null };
}

/**
 * Permanently deletes an asset and everything tied to it: attachments
 * (DB + R2), maintenance tickets (cascade), and any other asset's
 * linked_asset_id pointer (set null). Image files in R2 are removed too.
 */
export async function deleteAssetAction(id: string): Promise<DeleteAssetState> {
  if (!(await requireWritableTenant())) {
    return { error: TENANT_READ_ONLY_MESSAGE };
  }
  if (!(await requireModule("assets")) || !(await requirePermission("assets", "delete"))) {
    return { error: "You don't have permission to delete assets." };
  }

  const companyId = getCompanyIdFromHeaders();
  if (!companyId) {
    return { error: "Could not determine your company." };
  }

  const asset = await getAssetById(id);
  if (!asset) {
    return { error: "Asset not found." };
  }

  const result = await deleteAsset(id);
  if (result.error) {
    return { error: result.error };
  }

  await writeAuditLog({
    action: "asset.deleted",
    entityType: "asset",
    entityId: id,
    oldValues: { name: asset.name, assetCode: asset.assetCode },
  });

  revalidatePath("/assets");
  redirect("/assets");
}

export async function restoreAssetAction(id: string): Promise<DeleteAssetState> {
  if (!(await requireWritableTenant())) {
    return { error: TENANT_READ_ONLY_MESSAGE };
  }
  if (!(await requirePermission("assets", "delete"))) {
    return { error: "You don't have permission to restore assets." };
  }
  const result = await restoreAsset(id);
  if (result.error) {
    return { error: result.error };
  }
  await writeAuditLog({ action: "asset.restored", entityType: "asset", entityId: id });
  revalidatePath("/assets");
  revalidatePath(`/assets/${id}`);
  return { error: null };
}

export async function archiveAssetAction(id: string, archived: boolean): Promise<DeleteAssetState> {
  if (!(await requireWritableTenant())) {
    return { error: TENANT_READ_ONLY_MESSAGE };
  }
  if (!(await requirePermission("assets", "edit"))) {
    return { error: "You don't have permission to archive assets." };
  }
  const result = await setAssetArchived(id, archived);
  if (result.error) {
    return { error: result.error };
  }
  await writeAuditLog({
    action: archived ? "asset.archived" : "asset.unarchived",
    entityType: "asset",
    entityId: id,
  });
  revalidatePath("/assets");
  revalidatePath(`/assets/${id}`);
  return { error: null };
}

export async function deleteAssetDocumentAction(documentId: string): Promise<{ error: string | null }> {
  if (!(await requireWritableTenant())) {
    return { error: TENANT_READ_ONLY_MESSAGE };
  }
  if (!(await requireModule("documents")) || !(await requirePermission("assets", "edit"))) {
    return { error: "You don't have permission to delete documents." };
  }
  const companyId = getCompanyIdFromHeaders();
  if (!companyId) {
    return { error: "Could not determine your company." };
  }
  const document = await getAssetDocumentById(documentId);
  if (!document) {
    return { error: "Document not found." };
  }
  const result = await deleteAssetDocument(documentId);
  if (result.error) {
    return { error: result.error };
  }
  if (result.filePath) {
    await deleteFilesFromR2(companyId, [{ key: result.filePath, sizeBytes: result.sizeBytes }]);
  }
  await writeAuditLog({
    action: "asset.document_deleted",
    entityType: "asset_document",
    entityId: documentId,
    oldValues: { assetId: document.assetId, fileName: document.fileName },
  });
  revalidatePath(`/assets/${document.assetId}`);
  return { error: null };
}

/** Existing attachments for /assets/[id]'s Additional Info section. */
export async function getAssetAttachmentsForDetail(assetId: string): Promise<AssetAttachment[]> {
  if (!(await requirePermission("assets", "view"))) {
    return [];
  }
  return getAssetAttachments(assetId);
}

export async function getDocumentTypesForForm(): Promise<import("./types").DocumentTypeOption[]> {
  if (!(await requirePermission("assets", "view")) && !(await requirePermission("categories", "view"))) {
    return [];
  }
  return listDocumentTypes();
}

/**
 * Uploads a file and records it as an asset_documents row in one step —
 * unlike resolveImageUrl, this always needs an existing assetId (the FK
 * asset_documents.asset_id can't point at nothing), so it's only usable
 * once an asset has actually been created, i.e. from the edit form.
 */
export async function uploadAssetAttachmentAction(
  assetId: string,
  formData: FormData,
): Promise<{ error: string | null }> {
  if (!(await requireWritableTenant())) {
    return { error: TENANT_READ_ONLY_MESSAGE };
  }
  if (!(await requireModule("documents")) || !(await requirePermission("assets", "edit"))) {
    return { error: "You don't have permission to edit assets." };
  }

  const companyId = getCompanyIdFromHeaders();
  if (!companyId) {
    return { error: "Could not determine your company." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in." };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { error: "No file provided." };
  }

  const uploadResult = await uploadFileToR2({ companyId, folder: `assets/${assetId}/attachments`, file });
  if ("error" in uploadResult) {
    return { error: uploadResult.error };
  }

  const documentType = String(formData.get("documentType") ?? "other");
  const expiresAtRaw = String(formData.get("expiresAt") ?? "");
  const expiresAt = /^\d{4}-\d{2}-\d{2}$/.test(expiresAtRaw) ? expiresAtRaw : undefined;

  const result = await createAssetDocument({
    companyId,
    assetId,
    uploadedBy: user.id,
    fileName: file.name,
    filePath: uploadResult.key,
    fileSizeBytes: uploadResult.sizeBytes,
    mimeType: uploadResult.mimeType,
    documentType,
    expiresAt,
  });

  if ("error" in result) {
    return { error: result.error };
  }

  revalidatePath(`/assets/${assetId}`);
  return { error: null };
}

function flattenIssues(error: ZodError): Record<string, string> {
  // Object.create(null): no prototype, so an issue path that happened to
  // be "__proto__" or similar couldn't pollute anything even though `key`
  // is dynamic.
  const fieldErrors: Record<string, string> = Object.create(null);
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    // fieldErrors has no prototype (see above), so a dynamic key here
    // can't cause prototype pollution regardless of its value.
    // eslint-disable-next-line security/detect-object-injection
    if (!fieldErrors[key]) {
      // eslint-disable-next-line security/detect-object-injection
      fieldErrors[key] = issue.message;
    }
  }
  return fieldErrors;
}
