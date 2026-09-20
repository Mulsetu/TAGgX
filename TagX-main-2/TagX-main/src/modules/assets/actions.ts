"use server";

import "server-only";
import type { ZodError } from "zod";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { TENANT_HEADERS } from "@/lib/tenant";
import { requirePermission } from "@/lib/permissions/has-permission";
import { isCurrentUserSuperAdmin } from "@/lib/permissions/super-admin";
import {
  getAssetAttachments,
  getAssetById,
  getAssetCountsByCategory,
  getAssetCountsByStatus,
  getAssetFilterOptions,
  getAssetFormOptions,
  getAssetStorageObjects,
  getPublicAssetById,
  listAssetLocationHistory,
  listAssets,
} from "./queries";
import {
  createAsset,
  createAssetDocument,
  deleteAsset,
  generateAssetCode,
  markQrGenerated,
  recordAssetLocationMove,
  updateAsset,
} from "./mutations";
import { createPublicTicket } from "@/modules/maintenance/mutations";
import { countRecentPublicReports } from "@/modules/maintenance/queries";
import { getUserWithRole } from "@/modules/users/queries";
import { deleteFilesFromR2, uploadFileToR2 } from "@/modules/storage/mutations";
import { r2KeyFromStoredValue } from "@/lib/r2/client";
import { assetFormSchema, assetListQuerySchema, publicAssetIdSchema, publicAssetReportSchema } from "./validation";
import { getCategoryFieldsForAssetForm, getCategoryFieldsForCategory } from "@/modules/categories/actions";
import { getLocationPath } from "@/modules/locations/actions";
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
  PublicAsset,
  PublicAssetReportState,
  StatusAssetCount,
  TagPageViewer,
} from "./types";

function getCompanyIdFromHeaders(): string | null {
  return headers().get(TENANT_HEADERS.companyId);
}

/** For the dashboard's "assets by category" chart. */
export async function getAssetCountsByCategoryForDashboard(): Promise<CategoryAssetCount[]> {
  return getAssetCountsByCategory();
}

/** For the dashboard's "assets by status" chart. */
export async function getAssetCountsByStatusForDashboard(): Promise<StatusAssetCount[]> {
  return getAssetCountsByStatus();
}

/** For /assets — parses raw (untrusted) URL search params before querying. */
export async function getAssetsForList(
  rawSearchParams: Record<string, string | string[] | undefined>,
): Promise<AssetListResult> {
  const parsed = assetListQuerySchema.safeParse({
    page: rawSearchParams.page,
    categoryId: rawSearchParams.category,
    locationId: rawSearchParams.location,
    statusId: rawSearchParams.status,
  });

  const { page, categoryId, locationId, statusId } = parsed.success
    ? parsed.data
    : { page: 1, categoryId: undefined, locationId: undefined, statusId: undefined };

  return listAssets({ categoryId, locationId, statusId }, page, 25);
}

/** For /assets/[id] — the page calls this, never queries.ts directly. */
export async function getAssetDetail(id: string): Promise<Asset | null> {
  return getAssetById(id);
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
  const since = new Date(Date.now() - PUBLIC_REPORT_WINDOW_MS).toISOString();
  const recent = await countRecentPublicReports(asset.id, email, since);
  if (recent >= PUBLIC_REPORT_MAX_PER_WINDOW) {
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
  const [options, categoryFields] = await Promise.all([
    getAssetFormOptions(excludeAssetId),
    getCategoryFieldsForAssetForm(),
  ]);
  return { ...options, categoryFields };
}

/** Category/location options for the /assets list page's filter bar. */
export async function getAssetFilterOptionsForList() {
  return getAssetFilterOptions();
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
  table: "asset_categories" | "locations" | "asset_statuses" | "assets" | "users",
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
  };
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
  if (!(await requirePermission("assets", "create"))) {
    return { error: "You don't have permission to create assets." };
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

  const parsed = assetFormSchema.safeParse(readAssetFormData(formData));
  if (!parsed.success) {
    return { error: "Check the highlighted fields.", fieldErrors: flattenIssues(parsed.error) };
  }

  const referenceError = await validateCrossTenantReferences(parsed.data);
  if (referenceError) {
    return { error: referenceError };
  }

  const imageResult = await resolveImageUrl(companyId, formData, parsed.data.imageUrl);
  if (imageResult.error) {
    return { error: imageResult.error };
  }

  const customResult = await resolveCustomFields(parsed.data.categoryId, formData, {});
  if (customResult.fieldErrors) {
    return { error: "Check the highlighted fields.", fieldErrors: customResult.fieldErrors };
  }

  const assetCode = parsed.data.assetCode ?? (await generateAssetCode(companyId));

  const result = await createAsset({
    companyId,
    createdBy: user.id,
    assetCode,
    input: { ...parsed.data, imageUrl: imageResult.url ?? undefined },
    customFields: customResult.values,
  });

  if ("error" in result) {
    return { error: result.error };
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

  revalidatePath("/assets");
  redirect(`/assets/${result.id}`);
}

export async function updateAssetAction(
  id: string,
  _prevState: AssetFormState,
  formData: FormData,
): Promise<AssetFormState> {
  if (!(await requirePermission("assets", "edit"))) {
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

  const referenceError = await validateCrossTenantReferences(parsed.data);
  if (referenceError) {
    return { error: referenceError };
  }

  const imageResult = await resolveImageUrl(companyId, formData, parsed.data.imageUrl);
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

  const result = await updateAsset(id, assetCode, { ...parsed.data, imageUrl: imageResult.url ?? undefined }, customResult.values);
  if ("error" in result) {
    return { error: result.error };
  }

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
  if (!(await requirePermission("assets", "view"))) {
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

  revalidatePath(`/assets/${assetId}`);
  return { error: null };
}

/**
 * Permanently deletes an asset and everything tied to it: attachments
 * (DB + R2), maintenance tickets (cascade), and any other asset's
 * linked_asset_id pointer (set null). Image files in R2 are removed too.
 */
export async function deleteAssetAction(id: string): Promise<DeleteAssetState> {
  if (!(await requirePermission("assets", "delete"))) {
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

  const attachments = await getAssetStorageObjects(id);
  const files: { key: string; sizeBytes?: number }[] = [...attachments];
  if (asset.imageUrl) {
    files.push({ key: r2KeyFromStoredValue(asset.imageUrl) });
  }

  const result = await deleteAsset(id);
  if (result.error) {
    return { error: result.error };
  }

  await deleteFilesFromR2(companyId, files);

  revalidatePath("/assets");
  revalidatePath("/dashboard");
  redirect("/assets");
}

/** Existing attachments for /assets/[id]'s Additional Info section. */
export async function getAssetAttachmentsForDetail(assetId: string): Promise<AssetAttachment[]> {
  return getAssetAttachments(assetId);
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
  if (!(await requirePermission("assets", "edit"))) {
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

  const result = await createAssetDocument({
    companyId,
    assetId,
    uploadedBy: user.id,
    fileName: file.name,
    filePath: uploadResult.key,
    fileSizeBytes: uploadResult.sizeBytes,
    mimeType: uploadResult.mimeType,
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
