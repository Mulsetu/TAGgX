"use server";

import "server-only";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { TENANT_HEADERS } from "@/lib/tenant";
import { requirePermission } from "@/lib/permissions/has-permission";
import { isCurrentUserSuperAdmin } from "@/lib/permissions/super-admin";
import { auditExceptionLabel } from "./types";
import type {
  AuditDetail,
  AuditExportResult,
  AuditFormState,
  AuditItemListResult,
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

function getCompanyIdFromHeaders(): string | null {
  return headers().get(TENANT_HEADERS.companyId);
}

function revalidateAudit(id?: string) {
  revalidatePath(ADMIN_PATH);
  if (id) {
    revalidatePath(`${ADMIN_PATH}/${id}`);
  }
}

export async function getAuditsForAdmin(
  rawSearchParams: Record<string, string | string[] | undefined>,
): Promise<AuditListResult> {
  if (!(await requirePermission("audits", "view"))) {
    return { items: [], totalCount: 0, page: 1, pageSize: 25 };
  }

  const parsed = auditListQuerySchema.safeParse({ page: rawSearchParams.page });
  const page = parsed.success ? parsed.data.page : 1;
  return listAudits(page);
}

export async function getAuditDetail(id: string): Promise<AuditDetail | null> {
  if (!(await requirePermission("audits", "view"))) {
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
  if (!(await requirePermission("audits", "view"))) {
    return { items: [], totalCount: 0, page: 1, pageSize: 25 };
  }

  const idParsed = auditIdSchema.safeParse(id);
  if (!idParsed.success) {
    return { items: [], totalCount: 0, page: 1, pageSize: 25 };
  }

  const parsed = auditItemListQuerySchema.safeParse({
    page: rawSearchParams.page,
    tab: rawSearchParams.tab,
  });
  const { page, tab } = parsed.success ? parsed.data : { page: 1, tab: "all" as const };
  return listAuditItems(idParsed.data, { tab }, page);
}

export async function getAuditLocationsForForm(): Promise<AuditLocationOption[]> {
  if (!(await requirePermission("audits", "view"))) {
    return [];
  }
  return listAuditLocations();
}

export async function createAuditAction(
  _prevState: AuditFormState,
  formData: FormData,
): Promise<AuditFormState> {
  if (!(await requirePermission("audits", "create"))) {
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
  if (!(await requirePermission("audits", "edit"))) {
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
  if (!(await requirePermission("audits", "edit"))) {
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
  if (!(await requirePermission("audits", "delete"))) {
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
  if (!(await requirePermission("audits", "edit"))) {
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
  if (!(await requirePermission("audits", "edit"))) {
    return { error: "You don't have permission to record scans." };
  }

  const parsed = recordAuditScanSchema.safeParse({
    auditId: formData.get("auditId"),
    assetId: formData.get("assetId"),
    foundLocationId: formData.get("foundLocationId"),
    foundCondition: formData.get("foundCondition"),
    notes: formData.get("notes"),
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

  const foundLocationName = parsed.data.foundLocationId
    ? await getLocationName(parsed.data.foundLocationId)
    : null;
  if (parsed.data.foundLocationId && !foundLocationName) {
    return { error: "Location not found." };
  }

  const result = await recordAuditScan({
    auditId: parsed.data.auditId,
    assetId: parsed.data.assetId,
    userId: user.id,
    input: parsed.data,
    expectedLocationId: item.expectedLocationId,
    expectedCondition: item.expectedCondition,
    foundLocationName,
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

export async function markMissingAction(auditId: string, itemId: string): Promise<AuditFormState> {
  if (!(await requirePermission("audits", "edit"))) {
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

  const result = await markAuditItemMissing(parsed.data.auditId, parsed.data.itemId);
  revalidateAudit(parsed.data.auditId);
  return result;
}

export async function resolveAuditItemAction(
  _prevState: AuditFormState,
  formData: FormData,
): Promise<AuditFormState> {
  if (!(await requirePermission("audits", "edit"))) {
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
  if (!(await requirePermission("audits", "edit"))) {
    return null;
  }
  return findActiveAuditItemForAsset(parsed.data);
}

export async function exportAuditResultsAction(id: string): Promise<AuditExportResult | { error: string }> {
  if (!(await requirePermission("audits", "view"))) {
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
