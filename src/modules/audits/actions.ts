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
import { clientIpFromHeaders, consumeRateLimit } from "@/lib/rate-limit";
import { writeAuditLog } from "@/lib/audit-log";
import { dispatchEventEmail } from "@/modules/email/dispatch";
import { createTicket } from "@/modules/maintenance/mutations";
import type { PermissionAction } from "@/lib/permissions/taxonomy";
import { auditExceptionLabel } from "./types";
import type {
  AuditDetail,
  AuditExportResult,
  AuditFormState,
  AuditItemListResult,
  AuditListPage,
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
  raiseAuditTicketSchema,
  recordAuditScanSchema,
  resolveAuditItemSchema,
} from "./validation";
import {
  findActiveAuditItemForAsset,
  findAuditItemByScan,
  getAuditById,
  getAuditItem,
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
  linkAuditItemTicket,
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
  if (id) {
    revalidatePath(`${ADMIN_PATH}/${id}`);
    revalidatePath(`/floor/audits/${id}`);
  }
}

/**
 * The single Audits list. With no explicit filter it opens on running
 * audits (what floor staff need), falling back to all audits when none
 * are running so the page is never empty for no reason.
 */
export async function getAuditsForAdmin(
  rawSearchParams: Record<string, string | string[] | undefined>,
): Promise<AuditListPage> {
  if (!(await canUseAudits("view"))) {
    return { items: [], totalCount: 0, page: 1, pageSize: 25, filter: "all" };
  }

  const parsed = auditListQuerySchema.safeParse({ page: rawSearchParams.page, status: rawSearchParams.status });
  const page = parsed.success ? parsed.data.page : 1;
  const requested = parsed.success ? parsed.data.status : undefined;

  if (requested) {
    const result = await listAudits(page, undefined, requested === "all" ? undefined : requested);
    return { ...result, filter: requested };
  }

  const running = await listAudits(page, undefined, "active");
  if (running.totalCount > 0) {
    return { ...running, filter: "active" };
  }
  return { ...(await listAudits(page)), filter: "all" };
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
  const hasPhoto = photo instanceof File && photo.size > 0;
  if (isException && audit.requirePhotoOnException && !hasPhoto) {
    return { error: "A photo is required when recording an exception." };
  }
  // Keep any photo attached to a problem report, not only when the audit
  // requires one — previously an optional photo was silently dropped.
  if (isException && hasPhoto) {
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

function formatAuditCondition(value: string | null): string {
  return value ? value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()) : "—";
}

/**
 * Turns an audit exception into a maintenance ticket assigned to someone
 * (typically a Company Admin or Auditor), carrying everything the audit
 * found. One ticket per exception — the link on audit_items (migration
 * 0053) blocks duplicates.
 */
export async function raiseAuditTicketAction(
  _prevState: AuditFormState,
  formData: FormData,
): Promise<AuditFormState> {
  if (!(await requireWritableTenant())) {
    return { error: TENANT_READ_ONLY_MESSAGE };
  }
  if (!(await requireModule("maintenance")) || !(await requirePermission("maintenance", "create"))) {
    return { error: "You don't have permission to create maintenance tickets." };
  }
  if (!consumeRateLimit(`audit-ticket:${clientIpFromHeaders(headers())}`, 30, 60_000)) {
    return { error: "Too many requests. Wait a minute and try again." };
  }

  const parsed = raiseAuditTicketSchema.safeParse({
    auditId: formData.get("auditId"),
    itemId: formData.get("itemId"),
    assignedTo: formData.get("assignedTo") ?? "",
    priority: formData.get("priority"),
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const companyId = getCompanyIdFromHeaders();
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!companyId || !user) {
    return { error: "You must be signed in." };
  }

  const [audit, item] = await Promise.all([
    getAuditById(parsed.data.auditId),
    getAuditItem(parsed.data.auditId, parsed.data.itemId),
  ]);
  if (!audit || !item) {
    return { error: "Audit item not found." };
  }
  if (item.status !== "exception" || item.resolved) {
    return { error: "Only open problems can raise a ticket." };
  }
  if (item.maintenanceTicketId) {
    return { error: "A ticket was already raised for this asset." };
  }
  if (parsed.data.assignedTo) {
    const { data: assignee } = await supabase.from("users").select("id").eq("id", parsed.data.assignedTo).maybeSingle();
    if (!assignee) {
      return { error: "Choose someone from your company." };
    }
  }

  const problems = item.exceptionTypes.map(auditExceptionLabel).join(", ") || "Audit problem";
  const lines = [
    `Raised from audit "${audit.name}".`,
    `Problems: ${problems}.`,
    `Expected: ${item.expectedLocationName ?? "—"} · ${formatAuditCondition(item.expectedCondition)}.`,
    `Found: ${item.foundLocationName ?? "—"} · ${formatAuditCondition(item.foundCondition)}.`,
    item.notes ? `Auditor remark: ${item.notes}` : null,
    item.exceptionPhotoPath ? "A photo is attached on the audit page." : null,
    parsed.data.note ? `Note: ${parsed.data.note}` : null,
  ].filter((line): line is string => line !== null);

  const ticket = await createTicket({
    companyId,
    assetId: item.assetId,
    title: `Audit: ${problems} — ${item.assetName}`.slice(0, 200),
    description: lines.join("\n").slice(0, 2000),
    reportedBy: user.id,
    priority: parsed.data.priority,
    typeKey: "corrective",
    assignedTo: parsed.data.assignedTo,
  });
  if ("error" in ticket) {
    return { error: ticket.error };
  }

  const linked = await linkAuditItemTicket(item.id, ticket.id);
  if (linked.error) {
    return { error: linked.error };
  }

  await writeAuditLog({
    action: "maintenance.created",
    entityType: "maintenance_ticket",
    entityId: ticket.id,
    newValues: { fromAuditId: audit.id, auditItemId: item.id, assignedTo: parsed.data.assignedTo ?? null },
  });
  await dispatchEventEmail({
    companyId,
    eventKey: "maintenance_created",
    entityId: ticket.id,
    occurrenceKey: `ticket:${ticket.id}:created`,
    vars: {
      asset_name: item.assetName,
      asset_code: item.assetCode,
      maintenance_title: `Audit: ${problems}`,
      vendor_name: "",
      asset_url: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/assets/${item.assetId}`,
    },
  });

  revalidateAudit(audit.id);
  revalidatePath("/dashboard/administration/maintenance");
  return { error: null };
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
