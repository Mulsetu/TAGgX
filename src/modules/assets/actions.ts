"use server";

import "server-only";
import type { ZodError } from "zod";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isHostedAssetImage } from "@/lib/media-url";
import { TENANT_HEADERS } from "@/lib/tenant";
import { clientIpFromHeaders, consumeRateLimit } from "@/lib/rate-limit";
import { requirePermission } from "@/lib/permissions/has-permission";
import { getWorkspaceRuntime, requireModule } from "@/lib/permissions/features";
import { ASSET_FIELD_KEYS, parseAssetFieldConfig, type AssetFieldKey } from "@/lib/permissions/workspace-config";
import { parseCsv, toCsv } from "@/lib/csv";
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
  getCreatedAssetTrendPercent,
  getAssetIdsByCodes,
  getAssetImportReferences,
  listAssetQrLabels,
  listAssets,
  listChildAssets,
  listRecentAssets,
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
  insertImportJob,
  insertQrEvents,
  markQrGenerated,
  markQrGeneratedForAssets,
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
import {
  assetFormSchema,
  assetListQuerySchema,
  publicAssetIdSchema,
  publicAssetReportSchema,
  qrLabelsRequestSchema,
} from "./validation";
import { getCategoryFieldsForAssetForm, getCategoryFieldsForCategory, getCategoryPrefixForAsset } from "@/modules/categories/actions";
import { getVendorOptions } from "@/modules/vendors/actions";
import { getVendorById } from "@/modules/vendors/queries";
import { getLocationPath } from "@/modules/locations/actions";
import { assertCanCreateAsset } from "@/modules/billing/actions";
import { parseCategoryFieldValues } from "@/modules/categories/validation";
import type { CategoryField, CustomFieldValue } from "@/modules/categories/types";
import type {
  Asset,
  AssetAttachment,
  AssetFormOptions,
  AssetImportColumn,
  AssetImportState,
  AssetImportTemplate,
  AssetFormState,
  AssetListResult,
  AssetLocationMove,
  CategoryAssetCount,
  DeleteAssetState,
  LocationAssetCount,
  PublicAsset,
  PublicAssetReportState,
  QrLabel,
  QrLabelsState,
  StatusAssetCount,
  TagPageViewer,
} from "./types";
import {
  ASSET_IMPORT_COLUMNS,
  ASSET_IMPORT_ROW_LIMIT,
  CUSTOM_IMPORT_PREFIX,
  PARTNER_NAME_IMPORT_COLUMN,
  QR_LABEL_LIMIT,
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
    sort: rawSearchParams.sort ?? "updated",
    sortDir: rawSearchParams.dir,
    includeArchived: rawSearchParams.archived,
    pageSize: rawSearchParams.pageSize,
  });

  if (!parsed.success) {
    return listAssets({ sort: "updated" }, 1, 10);
  }

  const { page, pageSize, ...filters } = parsed.data;
  const size = pageSize === 25 || pageSize === 50 ? pageSize : 10;
  return listAssets(filters, page, size);
}

/** Recent rows for the company dashboard table. */
export async function getRecentAssetsForDashboard() {
  if (!(await requireModule("assets")) || !(await requirePermission("assets", "view"))) {
    return [];
  }
  return listRecentAssets(8);
}

/** Month-over-month change in newly created assets, for the dashboard stat cards. */
export async function getInventoryTrendForDashboard(): Promise<number> {
  if (!(await requireModule("assets")) || !(await requirePermission("assets", "view"))) {
    return 0;
  }
  return getCreatedAssetTrendPercent();
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

  const email = parsed.data.email?.toLowerCase() ?? null;
  const ip = clientIpFromHeaders(headers());
  if (!consumeRateLimit(`public-report:${ip}`, 5, PUBLIC_REPORT_WINDOW_MS)) {
    return { error: "Too many reports from this network. Try again in a few minutes." };
  }

  if (email) {
    const since = new Date(Date.now() - PUBLIC_REPORT_WINDOW_MS).toISOString();
    const recent = await countRecentPublicReports(asset.id, email, since);
    if (recent === null || recent >= PUBLIC_REPORT_MAX_PER_WINDOW) {
      return { error: "Too many reports from this email. Try again in a few minutes." };
    }
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
  skip: readonly string[] = [],
): Promise<Record<string, string> | null> {
  const runtime = await getWorkspaceRuntime();
  const fieldErrors: Record<string, string> = {};
  for (const key of ASSET_FIELD_KEYS) {
    const field = runtime.fields[key];
    if (!field.enabled || !field.required || skip.includes(key)) {
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
    const link = String(formData.get("imageLink") ?? "").trim();
    if (link) {
      if (!/^https:\/\/\S{1,2032}$/i.test(link)) {
        return { url: null, error: "Enter a valid https link, or leave the Drive link blank." };
      }
      return { url: link };
    }
    if (existingImageUrl && !isHostedAssetImage(existingImageUrl) && /^https?:\/\//i.test(existingImageUrl)) {
      return { url: null };
    }
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

  const assetCreateKey = `asset-create:${companyId}:${clientIpFromHeaders(headers())}`;
  if (!consumeRateLimit(assetCreateKey, 120, 60 * 60 * 1000)) {
    return { error: "Too many assets created. Try again later." };
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

  // Assignment isn't edited here (Actions tab owns it — see updateAsset), so don't require it.
  const configuredErrors = await missingConfiguredFields(parsed.data, ["allottedTo", "allotmentDate"]);
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
 * Bulk QR labels: the selected assets, or every asset matching the list
 * page's current filters (up to QR_LABEL_LIMIT). Stamps assets that never
 * had a QR as generated and logs a "printed" event for each label; the PDF
 * itself is drawn in the browser from the returned names and codes.
 */
export async function getQrLabelsAction(input: {
  assetIds?: string[];
  searchParams?: Record<string, string>;
}): Promise<QrLabelsState> {
  if (!(await requireWritableTenant())) {
    return { error: TENANT_READ_ONLY_MESSAGE };
  }
  if (!(await requireModule("qr")) || !(await requirePermission("assets", "edit"))) {
    return { error: "You don't have permission to generate QR tags." };
  }

  const companyId = getCompanyIdFromHeaders();
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!companyId || !user) {
    return { error: "Could not determine your company." };
  }
  if (!consumeRateLimit(`qr-bulk:${user.id}`, 30, 60 * 60 * 1000)) {
    return { error: "Too many QR downloads. Try again later." };
  }

  const parsed = qrLabelsRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Choose at least one asset." };
  }

  let labels: QrLabel[];
  let truncated = false;
  if (parsed.data.assetIds) {
    labels = await listAssetQrLabels(parsed.data.assetIds);
  } else {
    const raw = parsed.data.searchParams ?? {};
    const filters = assetListQuerySchema.safeParse({
      q: raw.q,
      categoryId: raw.category,
      locationId: raw.location,
      statusId: raw.status,
      vendorId: raw.vendor,
      allottedTo: raw.custodian,
      condition: raw.condition,
      warranty: raw.warranty,
      amc: raw.amc,
      documentExpiry: raw.docs,
      sort: raw.sort ?? "code",
      sortDir: raw.dir ?? "asc",
      includeArchived: raw.archived,
    });
    if (!filters.success) {
      return { error: "Those filters aren't valid. Clear them and try again." };
    }
    const result = await listAssets(filters.data, 1, QR_LABEL_LIMIT);
    labels = result.items.map((item) => ({ id: item.id, name: item.name, assetCode: item.assetCode }));
    truncated = result.totalCount > labels.length;
  }

  if (labels.length === 0) {
    return { error: "No assets to generate QR codes for." };
  }

  const ids = labels.map((label) => label.id);
  const stamped = await markQrGeneratedForAssets(ids);
  await insertQrEvents([
    ...stamped.map((assetId) => ({ companyId, assetId, eventType: "generated" as const, actorId: user.id })),
    ...ids.map((assetId) => ({ companyId, assetId, eventType: "printed" as const, actorId: user.id })),
  ]);
  await writeAuditLog({
    action: "asset.qr_bulk_generated",
    entityType: "asset",
    newValues: { labels: labels.length, newlyGenerated: stamped.length },
  });

  revalidatePath("/assets");
  return { error: null, labels, truncated };
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

// ---------------------------------------------------------------------
// CSV import
// ---------------------------------------------------------------------

const CORE_IMPORT_COLUMNS = ["name", "category", "location", "status"] as const;

function sampleCustomValue(field: CategoryField): string {
  switch (field.fieldType) {
    case "number":
      return "10";
    case "date":
      return "2026-01-31";
    case "select":
      return field.options[0] ?? "";
    case "checkbox":
      return "yes";
    case "email":
      return "name@example.com";
    case "url":
      return "https://example.com";
    case "phone":
      return "+91 98765 43210";
    default:
      return "";
  }
}

function customFieldHint(field: CategoryField): string | undefined {
  if (field.fieldType === "select") return `One of: ${field.options.join(", ")}`;
  if (field.fieldType === "checkbox") return "yes or no";
  if (field.fieldType === "date") return "YYYY-MM-DD";
  return undefined;
}

/**
 * Columns the add-asset import can take, for the picker on /assets/new:
 * name/category/location/status plus every built-in field the company has
 * marked required are always in the sample; other enabled fields and the
 * category custom fields are opt-in.
 */
export async function getAssetImportTemplateAction(): Promise<AssetImportTemplate> {
  const empty: AssetImportTemplate = { core: [], fields: [], categories: [] };
  if (!(await requireModule("assets")) || !(await requirePermission("assets", "create"))) {
    return empty;
  }

  const [runtime, refs, customFields] = await Promise.all([
    getWorkspaceRuntime(),
    getAssetImportReferences(),
    getCategoryFieldsForAssetForm(),
  ]);

  const core: AssetImportColumn[] = [
    { column: "name", label: "Name", example: "Sample laptop", required: true },
    { column: "category", label: "Category", example: refs.categories[0]?.name ?? "Your category", required: true },
    { column: "location", label: "Location", example: refs.locations[0]?.name ?? "Your location", required: true },
    { column: "status", label: "Status", example: refs.statuses[0]?.name ?? "Your status", required: true },
  ];

  const examples: Partial<Record<AssetFieldKey, string>> = {
    condition: refs.conditions[0]?.key ?? "good",
    department: runtime.departments[0] ?? "",
    vendorId: refs.vendors[0]?.name ?? "",
  };
  const fields: AssetImportColumn[] = [];
  const enabledKeys = ASSET_FIELD_KEYS.filter((key) => runtime.fields[key].enabled).sort(
    (a, b) => runtime.fields[a].order - runtime.fields[b].order,
  );
  for (const key of enabledKeys) {
    const spec = ASSET_IMPORT_COLUMNS[key];
    const setting = runtime.fields[key];
    fields.push({
      column: spec.column,
      label: setting.label,
      example: examples[key] ?? spec.example,
      hint: spec.hint,
      required: setting.required,
    });
    if (key === "ownershipType") {
      fields.push({
        column: PARTNER_NAME_IMPORT_COLUMN,
        label: "Partner name",
        example: "",
        hint: "Required when ownership is partner",
        required: false,
      });
    }
  }

  const categoryNames = new Map(refs.categories.map((category) => [category.id, category.name]));
  const grouped = new Map<string, AssetImportColumn[]>();
  for (const field of customFields) {
    const name = categoryNames.get(field.categoryId);
    if (!name) continue;
    grouped.set(name, [
      ...(grouped.get(name) ?? []),
      {
        column: `${CUSTOM_IMPORT_PREFIX}${field.key}`,
        label: field.label,
        example: sampleCustomValue(field),
        hint: customFieldHint(field),
        required: field.required,
      },
    ]);
  }

  return {
    core,
    fields,
    categories: Array.from(grouped.entries()).map(([categoryName, columns]) => ({ categoryName, columns })),
  };
}

/**
 * Reads this row's `custom_<key>` columns for its category's fields and
 * validates them exactly like the asset form does.
 */
function importCustomFields(
  record: Map<string, string>,
  fields: CategoryField[],
): { values: Record<string, CustomFieldValue> } | { error: string } {
  const formData = new FormData();
  for (const field of fields) {
    let value = record.get(`${CUSTOM_IMPORT_PREFIX}${field.key}`) ?? "";
    if (field.fieldType === "checkbox") {
      value = /^(yes|y|true|1|on)$/i.test(value) ? "true" : "";
    } else if (field.fieldType === "select") {
      value = field.options.find((option) => option.toLowerCase() === value.toLowerCase()) ?? value;
    }
    formData.set(`customField.${field.key}`, value);
  }
  const parsed = parseCategoryFieldValues(fields, formData);
  const messages = Object.values(parsed.fieldErrors);
  return messages.length > 0 ? { error: messages.join(" ") } : { values: parsed.values };
}

function byLowerName(options: { id: string; name: string }[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const option of options) {
    const key = option.name.trim().toLowerCase();
    if (!map.has(key)) map.set(key, option.id);
  }
  return map;
}

/**
 * Add-asset CSV import. Each row goes through the same validation as the
 * asset form (schema, required fields, custom fields, cross-tenant
 * references); codes come from the category prefix and rows stop at the
 * plan limit. Bad rows are skipped and returned as an error CSV.
 */
export async function importAssetsCsvAction(_prev: AssetImportState, formData: FormData): Promise<AssetImportState> {
  if (!(await requireWritableTenant())) {
    return { error: TENANT_READ_ONLY_MESSAGE };
  }
  if (!(await requireModule("assets")) || !(await requirePermission("assets", "create"))) {
    return { error: "You don't have permission to import assets." };
  }
  const companyId = getCompanyIdFromHeaders();
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!companyId || !user) {
    return { error: "Could not determine your company." };
  }
  if (!consumeRateLimit(`asset-import:${companyId}`, 20, 60 * 60 * 1000)) {
    return { error: "Too many imports. Try again later." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a CSV file." };
  }
  if (file.size > 2_000_000 || !/\.csv$/i.test(file.name)) {
    return { error: "Upload a .csv file under 2 MB." };
  }

  const parsedCsv = parseCsv(await file.text());
  const header = parsedCsv[0]?.map((column) => column.trim().toLowerCase()) ?? [];
  const dataRows = parsedCsv.slice(1);
  const runtime = await getWorkspaceRuntime();

  const requiredColumns = [
    ...CORE_IMPORT_COLUMNS,
    ...ASSET_FIELD_KEYS.filter((key) => runtime.fields[key].enabled && runtime.fields[key].required).map(
      (key) => ASSET_IMPORT_COLUMNS[key].column,
    ),
  ];
  const missing = requiredColumns.filter((column) => !header.includes(column));
  if (missing.length > 0) {
    return { error: `The CSV is missing required columns: ${missing.join(", ")}. Download a fresh sample.` };
  }
  if (dataRows.length === 0) {
    return { error: "The CSV has no asset rows." };
  }
  if (dataRows.length > ASSET_IMPORT_ROW_LIMIT) {
    return { error: `Import up to ${ASSET_IMPORT_ROW_LIMIT} assets at a time.` };
  }

  const records = dataRows.map(
    (values) => new Map(header.map((column, index) => [column, (values[index] ?? "").trim()])),
  );
  const assetCodes = new Set<string>();
  for (const record of records) {
    for (const column of ["parent_asset_code", "linked_asset_code"]) {
      const code = record.get(column);
      if (code) assetCodes.add(code);
    }
  }

  const [refs, customFieldsOn, assetIdsByCode] = await Promise.all([
    getAssetImportReferences(),
    requireModule("custom_fields"),
    getAssetIdsByCodes(Array.from(assetCodes)),
  ]);
  const categories = byLowerName(refs.categories);
  const locations = byLowerName(refs.locations);
  const statuses = byLowerName(refs.statuses);
  const vendors = byLowerName(refs.vendors);
  const users = new Map(refs.users.map((row) => [row.email.toLowerCase(), row.id]));
  const conditions = new Map<string, string>();
  for (const condition of refs.conditions) {
    conditions.set(condition.key.toLowerCase(), condition.key);
    conditions.set(condition.name.trim().toLowerCase(), condition.key);
  }
  const fieldLabel = (key: string) =>
    (ASSET_FIELD_KEYS as readonly string[]).includes(key) ? runtime.fields[key as AssetFieldKey].label : key;

  const fieldCache = new Map<string, CategoryField[]>();
  const errors: string[][] = [["line", "name", "error"]];
  let successCount = 0;
  let limitMessage: string | null = null;

  for (let i = 0; i < records.length; i += 1) {
    const record = records[i] ?? new Map<string, string>();
    const name = record.get("name") ?? "";
    const line = String(i + 2);
    const fail = (message: string) => errors.push([line, name, message]);

    if (limitMessage) {
      fail(limitMessage);
      continue;
    }

    const problems: string[] = [];
    const lookup = (column: string, map: Map<string, string>, label: string): string | undefined => {
      const value = record.get(column) ?? "";
      if (!value) return undefined;
      const id = map.get(value.toLowerCase());
      if (!id) problems.push(`Unknown ${label} "${value}".`);
      return id;
    };

    const raw: Record<string, unknown> = {
      name,
      categoryId: lookup("category", categories, "category"),
      locationId: lookup("location", locations, "location"),
      statusId: lookup("status", statuses, "status"),
      ownershipType: "owned",
      partnerName: record.get(PARTNER_NAME_IMPORT_COLUMN) || undefined,
    };
    for (const key of ASSET_FIELD_KEYS) {
      const column = ASSET_IMPORT_COLUMNS[key].column;
      const value = record.get(column);
      if (!value) continue;
      switch (key) {
        case "vendorId":
          raw.vendorId = lookup(column, vendors, "vendor");
          break;
        case "allottedTo":
          raw.allottedTo = lookup(column, users, "user email");
          break;
        case "parentAssetId":
        case "linkedAssetId":
          raw[key] = lookup(column, assetIdsByCode, "asset code");
          break;
        case "condition":
          raw.condition = lookup(column, conditions, "condition");
          break;
        case "ownershipType":
        case "criticality":
          raw[key] = value.toLowerCase();
          break;
        default:
          raw[key] = value;
      }
    }
    if (problems.length > 0) {
      fail(problems.join(" "));
      continue;
    }

    const parsed = assetFormSchema.safeParse(raw);
    if (!parsed.success) {
      fail(
        parsed.error.issues
          .map((issue) => `${fieldLabel(String(issue.path[0] ?? ""))}: ${issue.message}`)
          .join(" "),
      );
      continue;
    }
    const configuredErrors = await missingConfiguredFields(parsed.data);
    if (configuredErrors) {
      fail(Object.values(configuredErrors).join(" "));
      continue;
    }
    const referenceError = await validateCrossTenantReferences(parsed.data);
    if (referenceError) {
      fail(referenceError);
      continue;
    }

    let customFields: Record<string, CustomFieldValue> = {};
    if (customFieldsOn) {
      let fields = fieldCache.get(parsed.data.categoryId);
      if (!fields) {
        fields = await getCategoryFieldsForCategory(parsed.data.categoryId);
        fieldCache.set(parsed.data.categoryId, fields);
      }
      const custom = importCustomFields(record, fields);
      if ("error" in custom) {
        fail(custom.error);
        continue;
      }
      customFields = custom.values;
    }

    const quota = await assertCanCreateAsset();
    if ("error" in quota) {
      limitMessage = quota.error;
      fail(limitMessage);
      continue;
    }

    const input = await withVendorName(parsed.data);
    const assetCode = await generateAssetCode(companyId, await getCategoryPrefixForAsset(parsed.data.categoryId));
    const result = await createAsset({ companyId, createdBy: user.id, assetCode, input, customFields });
    if ("error" in result) {
      fail(result.error);
      continue;
    }
    await recordAssetLocationMove({
      companyId,
      assetId: result.id,
      userId: user.id,
      fromLocationId: null,
      toLocationId: parsed.data.locationId,
      fromLocationPath: null,
      toLocationPath: await getLocationPath(parsed.data.locationId),
    });
    successCount += 1;
  }

  const errorCount = errors.length - 1;
  const errorCsv = errorCount > 0 ? toCsv(errors) : null;
  await insertImportJob({
    companyId,
    createdBy: user.id,
    totalRows: records.length,
    successCount,
    errorCount,
    errorReport: errorCsv,
  });
  await writeAuditLog({ action: "assets.imported", entityType: "import_job", newValues: { successCount, errorCount } });
  revalidatePath("/assets");
  return { error: null, result: { successCount, errorCount, errorCsv: errorCsv ?? undefined } };
}
