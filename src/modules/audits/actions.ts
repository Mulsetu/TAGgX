"use server";

import "server-only";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { TENANT_HEADERS } from "@/lib/tenant";
import { uploadFileToR2 } from "@/modules/storage/mutations";
import { requirePermission } from "@/lib/permissions/has-permission";
import { TENANT_READ_ONLY_MESSAGE, requireWritableTenant } from "@/lib/permissions/tenant-access";
import { requireModule } from "@/lib/permissions/features";
import { isCurrentUserSuperAdmin } from "@/lib/permissions/super-admin";
import type { PermissionAction } from "@/lib/permissions/taxonomy";
import { auditExceptionLabel } from "./types";
import type {
  AuditDetail,
  AuditExportResult,
  AuditFormState,
  AuditItemListResult,
  AuditListItem,
  AuditListResult,
  AuditLocationOption,
  AuditScanMatch,
  AuditScanState,
  AuditTagContext,
} from "./types";
import {
  auditIdSchema,
  auditItemListQuerySchema,
  auditListQuerySchema,
  auditScanLookupSchema,
  createAuditSchema,
  markMissingSchema,
  parseAssetScanQuery,
  recordAuditScanSchema,
  resolveAuditItemSchema,
} from "./validation";
import {
  findActiveAuditItemForAsset,
  findAuditItemByScan,
  getAuditById,
  getLocationName,
  listAllAuditItems,
  listAuditConditionOptions,
  listAuditExceptionTypeOptions,
  listAuditItems,
  listAuditLocations,
  listAudits,
  listAssetsForAuditScope,
} from "./queries";
import {
  completeAudit,
  createAuditWithItems,
  deleteDraftAudit,
  markAuditItemMissing,
  recordAuditScan,
  resolveAuditItem,
  startAudit,
} from "./mutations";

const ADMIN_PATH = "/dashboard/administration/audits";

async function canUseAudits(action: PermissionAction): Promise<boolean> {
  return (await requireModule("audits")) && (await requirePermission("audits", action));
}

function getCompanyIdFromHeaders(): string | null {
  return headers().get(TENANT_HEADERS.companyId);
}

function revalidateAudit(id?: string) {
  revalidatePath(ADMIN_PATH);
  revalidatePath("/floor/audits");
  if (id) {
    revalidatePath(`${ADMIN_PATH}/${id}`);
    revalidatePath(`/floor/audits/${id}`);
  }
}

export async function getAuditsForAdmin(
  rawSearchParams: Record<string, string | string[] | undefined>,
): Promise<AuditListResult> {
  if (!(await canUseAudits("view"))) {
    return { items: [], totalCount: 0, page: 1, pageSize: 25 };
  }

  const parsed = auditListQuerySchema.safeParse({ page: rawSearchParams.page });
  const page = parsed.success ? parsed.data.page : 1;
  return listAudits(page);
}

export async function getActiveAuditsForFloor(): Promise<AuditListItem[]> {
  if (!(await canUseAudits("view"))) {
    return [];
  }
  const result = await listAudits(1, 50, "active");
  return result.items;
}

export async function getAuditDetail(id: string): Promise<AuditDetail | null> {
  if (!(await canUseAudits("view"))) {
    return null;
  }
  const parsed = auditIdSchema.safeParse(id);
  if (!parsed.success) {
    return null;
  }
  return getAuditById(parsed.data);
}

export async function getAuditItemsForDetail(
  id: string,
  rawSearchParams: Record<string, string | string[] | undefined>,
): Promise<AuditItemListResult> {
  if (!(await canUseAudits("view"))) {
    return { items: [], totalCount: 0, page: 1, pageSize: 25 };
  }

  const idParsed = auditIdSchema.safeParse(id);
  if (!idParsed.success) {
    return { items: [], totalCount: 0, page: 1, pageSize: 25 };
  }

  const parsed = auditItemListQuerySchema.safeParse({
    page: rawSearchParams.page,
    tab: rawSearchParams.tab,
    exceptionType: rawSearchParams.exception,
  });
  const { page, tab, exceptionType } = parsed.success
    ? parsed.data
    : { page: 1, tab: "all" as const, exceptionType: undefined };
  return listAuditItems(idParsed.data, { tab, exceptionType }, page);
}

export async function getAuditLocationsForForm(): Promise<AuditLocationOption[]> {
  if (!(await canUseAudits("view"))) {
    return [];
  }
  return listAuditLocations();
}

export async function getAuditScanCatalog(): Promise<{
  conditions: { key: string; name: string }[];
  exceptionTypes: { key: string; name: string }[];
}> {
  if (!(await canUseAudits("view"))) {
    return { conditions: [], exceptionTypes: [] };
  }
  const [conditions, exceptionTypes] = await Promise.all([
    listAuditConditionOptions(),
    listAuditExceptionTypeOptions(),
  ]);
  return { conditions, exceptionTypes };
}

export async function createAuditAction(
  _prevState: AuditFormState,
  formData: FormData,
): Promise<AuditFormState> {
  if (!(await requireWritableTenant())) {
    return { error: TENANT_READ_ONLY_MESSAGE };
  }
  if (!(await canUseAudits("create"))) {
    return { error: "You don't have permission to create audits." };
  }

  const companyId = getCompanyIdFromHeaders();
  if (!companyId) {
    return { error: "Could not determine your company." };
  }

  const parsed = createAuditSchema.safeParse({
    name: formData.get("name"),
    scheduledDate: formData.get("scheduledDate"),
    locationId: formData.get("locationId"),
    requirePhotoOnException: formData.get("requirePhotoOnException") === "on",
    requireRemarkOnException: formData.get("requireRemarkOnException") === "on",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  let locationName: string | null = null;
  if (parsed.data.locationId) {
    locationName = await getLocationName(parsed.data.locationId);
    if (!locationName) {
      return { error: "Location not found." };
    }
  }

  const snapshots = await listAssetsForAuditScope(parsed.data.locationId ?? null);
  if (snapshots.length === 0) {
    return { error: "No assets in this scope. Add assets first, or pick a different location." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in." };
  }

  const result = await createAuditWithItems({
    companyId,
    createdBy: user.id,
    input: parsed.data,
    locationName,
    snapshots,
  });
  if ("error" in result) {
    return { error: result.error };
  }

  revalidateAudit(result.id);
  return { error: null, id: result.id };
}

export async function startAuditAction(id: string): Promise<AuditFormState> {
  if (!(await requireWritableTenant())) {
    return { error: TENANT_READ_ONLY_MESSAGE };
  }
  if (!(await canUseAudits("edit"))) {
    return { error: "You don't have permission to start audits." };
  }
  const parsed = auditIdSchema.safeParse(id);
  if (!parsed.success) {
    return { error: "Audit not found." };
  }
  const result = await startAudit(parsed.data);
  revalidateAudit(parsed.data);
  return result;
}

export async function completeAuditAction(id: string): Promise<AuditFormState> {
  if (!(await requireWritableTenant())) {
    return { error: TENANT_READ_ONLY_MESSAGE };
  }
  if (!(await canUseAudits("edit"))) {
    return { error: "You don't have permission to complete audits." };
  }
  const parsed = auditIdSchema.safeParse(id);
  if (!parsed.success) {
    return { error: "Audit not found." };
  }
  const result = await completeAudit(parsed.data);
  revalidateAudit(parsed.data);
  return result;
}

export async function deleteAuditAction(id: string): Promise<AuditFormState> {
  if (!(await requireWritableTenant())) {
    return { error: TENANT_READ_ONLY_MESSAGE };
  }
  if (!(await canUseAudits("delete"))) {
    return { error: "You don't have permission to delete audits." };
  }
  const parsed = auditIdSchema.safeParse(id);
  if (!parsed.success) {
    return { error: "Audit not found." };
  }
  const result = await deleteDraftAudit(parsed.data);
  revalidateAudit();
  return result;
}

export async function lookupAuditScanAction(
  auditId: string,
  query: string,
): Promise<{ match: AuditScanMatch | null; error: string | null }> {
  if (!(await canUseAudits("edit"))) {
    return { match: null, error: "You don't have permission to scan assets." };
  }

  const parsed = auditScanLookupSchema.safeParse({ auditId, query });
  if (!parsed.success) {
    return { match: null, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const audit = await getAuditById(parsed.data.auditId);
  if (!audit) {
    return { match: null, error: "Audit not found." };
  }
  if (audit.status !== "active") {
    return { match: null, error: "Start the audit before scanning assets." };
  }

  const item = await findAuditItemByScan(parsed.data.auditId, parseAssetScanQuery(parsed.data.query));
  if (!item) {
    return { match: null, error: "That asset is not in this audit's scope." };
  }

  return { match: { item, auditId: audit.id, auditName: audit.name }, error: null };
}

export async function recordAuditScanAction(
  _prevState: AuditScanState,
  formData: FormData,
): Promise<AuditScanState> {
  if (!(await requireWritableTenant())) {
    return { error: TENANT_READ_ONLY_MESSAGE };
  }
  if (!(await canUseAudits("edit"))) {
    return { error: "You don't have permission to record scans." };
  }

  const parsed = recordAuditScanSchema.safeParse({
    auditId: formData.get("auditId"),
    assetId: formData.get("assetId"),
    foundLocationId: formData.get("foundLocationId"),
    foundCondition: formData.get("foundCondition"),
    notes: formData.get("notes"),
    force: formData.get("force"),
    extraExceptionTypes: formData.getAll("exceptionType").map(String),
    foundCustodianId: formData.get("foundCustodianId"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in." };
  }

  const audit = await getAuditById(parsed.data.auditId);
  if (!audit || audit.status !== "active") {
    return { error: "Start the audit before scanning assets." };
  }

  const item = await findAuditItemByScan(parsed.data.auditId, { assetId: parsed.data.assetId, assetCode: null });
  if (!item) {
    return { error: "That asset is not in this audit's scope." };
  }

  if (item.status !== "unverified") {
    if (!parsed.data.force || !(await canUseAudits("edit"))) {
      return { error: "This asset was already recorded. A supervisor can replace the previous scan." };
    }
  }

  const foundLocationName = parsed.data.foundLocationId
    ? await getLocationName(parsed.data.foundLocationId)
    : null;
  if (parsed.data.foundLocationId && !foundLocationName) {
    return { error: "Location not found." };
  }

  const evaluatedPreview = {
    expectedLocationId: item.expectedLocationId,
    expectedCondition: item.expectedCondition,
    foundLocationId: parsed.data.foundLocationId,
    foundCondition: parsed.data.foundCondition,
  };
  const locationMismatch =
    Boolean(evaluatedPreview.expectedLocationId) &&
    Boolean(evaluatedPreview.foundLocationId) &&
    evaluatedPreview.expectedLocationId !== evaluatedPreview.foundLocationId;
  const conditionMismatch =
    Boolean(evaluatedPreview.expectedCondition) &&
    Boolean(evaluatedPreview.foundCondition) &&
    evaluatedPreview.expectedCondition !== evaluatedPreview.foundCondition;
  const isException =
    locationMismatch || conditionMismatch || (parsed.data.extraExceptionTypes?.length ?? 0) > 0;
  if (isException && audit.requireRemarkOnException && !parsed.data.notes) {
    return { error: "A remark is required when recording an exception." };
  }

  let exceptionPhotoPath: string | null = null;
  const photo = formData.get("photo");
  if (isException && audit.requirePhotoOnException) {
    if (!(photo instanceof File) || photo.size === 0) {
      return { error: "A photo is required when recording an exception." };
    }
    const companyId = getCompanyIdFromHeaders();
    if (!companyId) {
      return { error: "Could not determine your company." };
    }
    const upload = await uploadFileToR2({
      companyId,
      folder: `audits/${parsed.data.auditId}/exceptions`,
      file: photo,
    });
    if ("error" in upload) {
      return { error: upload.error };
    }
    exceptionPhotoPath = upload.key;
  }

  const { data: assetRow } = await supabase
    .from("assets")
    .select("allotted_to")
    .eq("id", parsed.data.assetId)
    .maybeSingle<{ allotted_to: string | null }>();

  const result = await recordAuditScan({
    auditId: parsed.data.auditId,
    assetId: parsed.data.assetId,
    userId: user.id,
    input: parsed.data,
    expectedLocationId: item.expectedLocationId,
    expectedCondition: item.expectedCondition,
    foundLocationName,
    exceptionPhotoPath,
    expectedCustodianId: assetRow?.allotted_to ?? null,
  });
  if (result.error) {
    return { error: result.error };
  }

  revalidateAudit(parsed.data.auditId);
  revalidatePath(`/tag/${parsed.data.assetId}`);

  if (result.status === "verified") {
    return { error: null, success: `${item.assetCode} verified.` };
  }
  const labels = result.exceptionTypes.map(auditExceptionLabel).join(", ");
  return { error: null, success: `${item.assetCode} flagged: ${labels}.` };
}

export async function markMissingAction(auditId: string, itemId: string, formData?: FormData): Promise<AuditFormState> {
  if (!(await requireWritableTenant())) {
    return { error: TENANT_READ_ONLY_MESSAGE };
  }
  if (!(await canUseAudits("edit"))) {
    return { error: "You don't have permission to update this audit." };
  }

  const parsed = markMissingSchema.safeParse({ auditId, itemId });
  if (!parsed.success) {
    return { error: "Invalid item." };
  }

  const audit = await getAuditById(parsed.data.auditId);
  if (!audit || audit.status !== "active") {
    return { error: "Assets can only be marked missing while the audit is active." };
  }

  let exceptionPhotoPath: string | null = null;
  if (audit.requirePhotoOnException) {
    const photo = formData?.get("photo");
    if (!(photo instanceof File) || photo.size === 0) {
      return { error: "A photo is required when marking an asset missing." };
    }
    const companyId = getCompanyIdFromHeaders();
    if (!companyId) {
      return { error: "Could not determine your company." };
    }
    const upload = await uploadFileToR2({
      companyId,
      folder: `audits/${parsed.data.auditId}/exceptions`,
      file: photo,
    });
    if ("error" in upload) {
      return { error: upload.error };
    }
    exceptionPhotoPath = upload.key;
  }

  const result = await markAuditItemMissing(parsed.data.auditId, parsed.data.itemId, exceptionPhotoPath);
  revalidateAudit(parsed.data.auditId);
  return result;
}

export async function resolveAuditItemAction(
  _prevState: AuditFormState,
  formData: FormData,
): Promise<AuditFormState> {
  if (!(await requireWritableTenant())) {
    return { error: TENANT_READ_ONLY_MESSAGE };
  }
  if (!(await canUseAudits("edit"))) {
    return { error: "You don't have permission to resolve exceptions." };
  }

  const parsed = resolveAuditItemSchema.safeParse({
    auditId: formData.get("auditId"),
    itemId: formData.get("itemId"),
    resolutionNotes: formData.get("resolutionNotes"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in." };
  }

  const result = await resolveAuditItem(parsed.data.itemId, user.id, parsed.data.resolutionNotes);
  revalidateAudit(parsed.data.auditId);
  return result;
}

export async function getAuditTagContext(assetId: string): Promise<AuditTagContext | null> {
  if (await isCurrentUserSuperAdmin()) {
    return null;
  }
  const parsed = auditIdSchema.safeParse(assetId);
  if (!parsed.success) {
    return null;
  }
  if (!(await canUseAudits("edit"))) {
    return null;
  }
  return findActiveAuditItemForAsset(parsed.data);
}

export async function exportAuditResultsAction(id: string): Promise<AuditExportResult | { error: string }> {
  if (!(await canUseAudits("view"))) {
    return { error: "You don't have permission to export audits." };
  }

  const parsed = auditIdSchema.safeParse(id);
  if (!parsed.success) {
    return { error: "Audit not found." };
  }

  const [audit, items] = await Promise.all([getAuditById(parsed.data), listAllAuditItems(parsed.data)]);
  if (!audit) {
    return { error: "Audit not found." };
  }

  const header = [
    "Asset code",
    "Asset name",
    "Expected location",
    "Found location",
    "Expected condition",
    "Found condition",
    "Status",
    "Exceptions",
    "Notes",
    "Resolved",
    "Resolution notes",
    "Scanned at",
  ];

  const rows = items.map((item) => [
    item.assetCode,
    item.assetName,
    item.expectedLocationName ?? "",
    item.foundLocationName ?? "",
    item.expectedCondition ?? "",
    item.foundCondition ?? "",
    item.status,
    item.exceptionTypes.map(auditExceptionLabel).join("; "),
    item.notes ?? "",
    item.resolved ? "yes" : "no",
    item.resolutionNotes ?? "",
    item.scannedAt ?? "",
  ]);

  const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
  const slug = audit.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "audit";
  return { csv, filename: `${slug}-${audit.scheduledDate}.csv` };
}

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
