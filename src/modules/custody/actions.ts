"use server";

import "server-only";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { TENANT_HEADERS } from "@/lib/tenant";
import { requirePermission } from "@/lib/permissions/has-permission";
import type { PermissionAction } from "@/lib/permissions/taxonomy";
import { TENANT_READ_ONLY_MESSAGE, requireWritableTenant } from "@/lib/permissions/tenant-access";
import { getWorkspaceRuntime, requireModule } from "@/lib/permissions/features";
import { writeAuditLog } from "@/lib/audit-log";
import { createClient, getRequestAuthUser } from "@/lib/supabase/server";
import { getAssetById, listMissingRequiredDocuments } from "@/modules/assets/queries";
import { recordAssetLocationMove, updateAssetStatus } from "@/modules/assets/mutations";
import { getLocationPath } from "@/modules/locations/actions";
import { dispatchEventEmail } from "@/modules/email/dispatch";
import { getPendingHandoverForUser, getPendingTransferForAsset as queryPendingTransfer, listLifecycleEvents } from "./queries";
import {
  acceptTransfer,
  acknowledgeHandover,
  getTransferById,
  insertHandover,
  insertLifecycleEvent,
  insertReturn,
  insertTransfer,
  rejectTransfer,
  updateAssetCustody,
} from "./mutations";
import { handoverSchema, returnSchema, transferSchema, disposeSchema } from "./validation";
import type { CustodyFormState, LifecycleEvent } from "./types";

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "";
}

export async function getLifecycleEventsForAsset(assetId: string): Promise<LifecycleEvent[]> {
  if (!(await requirePermission("assets", "view"))) {
    return [];
  }
  return listLifecycleEvents(assetId);
}

export async function getPendingAcknowledgement(assetId: string): Promise<{ id: string } | null> {
  const user = await getRequestAuthUser();
  if (!user) {
    return null;
  }
  return getPendingHandoverForUser(assetId, user.id);
}

export async function getPendingTransferForAsset(assetId: string) {
  if (!(await requirePermission("assets", "view"))) {
    return null;
  }
  return queryPendingTransfer(assetId);
}

export async function handoverAssetAction(
  _prev: CustodyFormState,
  formData: FormData,
): Promise<CustodyFormState> {
  if (!(await requireWritableTenant())) {
    return { error: TENANT_READ_ONLY_MESSAGE };
  }
  if (!(await requireModule("handover")) || !(await requirePermission("handover", "assign"))) {
    return { error: "You don't have permission to hand over assets." };
  }
  const companyId = headers().get(TENANT_HEADERS.companyId);
  const user = await getRequestAuthUser();
  if (!companyId || !user) {
    return { error: "Could not determine your company." };
  }

  const parsed = handoverSchema.safeParse({
    assetId: formData.get("assetId"),
    toUserId: formData.get("toUserId"),
    handedOverAt: formData.get("handedOverAt"),
    accessories: formData.get("accessories"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const asset = await getAssetById(parsed.data.assetId);
  if (!asset) {
    return { error: "Asset not found." };
  }

  const result = await insertHandover(companyId, user.id, asset.allottedTo, parsed.data);
  if ("error" in result) {
    return { error: result.error };
  }

  const update = await updateAssetCustody({
    assetId: asset.id,
    allottedTo: parsed.data.toUserId,
    allotmentDate: parsed.data.handedOverAt,
  });
  if (update.error) {
    return { error: update.error };
  }

  await insertLifecycleEvent({
    companyId,
    assetId: asset.id,
    eventType: "handover",
    summary: `Handed over to a team member`,
    actorId: user.id,
    payload: { handoverId: result.id, toUserId: parsed.data.toUserId },
  });
  await writeAuditLog({ action: "asset.handover", entityType: "asset", entityId: asset.id, newValues: parsed.data });
  await dispatchEventEmail({
    companyId,
    eventKey: "asset_assigned",
    entityId: asset.id,
    occurrenceKey: `handover:${result.id}`,
    vars: {
      asset_name: asset.name,
      asset_code: asset.assetCode,
      asset_url: `${appUrl()}/assets/${asset.id}`,
      organization_name: "",
    },
  });
  revalidatePath(`/assets/${asset.id}`);
  return { error: null, success: "Handover recorded." };
}

export async function acknowledgeHandoverAction(handoverId: string): Promise<CustodyFormState> {
  if (!(await requireWritableTenant())) {
    return { error: TENANT_READ_ONLY_MESSAGE };
  }
  const user = await getRequestAuthUser();
  if (!user) {
    return { error: "You must be signed in." };
  }
  const result = await acknowledgeHandover(handoverId, user.id);
  if (result.error) {
    return { error: result.error };
  }
  return { error: null, success: "Acknowledged." };
}

export async function returnAssetAction(
  _prev: CustodyFormState,
  formData: FormData,
): Promise<CustodyFormState> {
  if (!(await requireWritableTenant())) {
    return { error: TENANT_READ_ONLY_MESSAGE };
  }
  if (!(await requireModule("handover")) || !(await requirePermission("handover", "return"))) {
    return { error: "You don't have permission to return assets." };
  }
  const companyId = headers().get(TENANT_HEADERS.companyId);
  const user = await getRequestAuthUser();
  if (!companyId || !user) {
    return { error: "Could not determine your company." };
  }
  const parsed = returnSchema.safeParse({
    assetId: formData.get("assetId"),
    returnedAt: formData.get("returnedAt"),
    conditionKey: formData.get("conditionKey"),
    damageRemarks: formData.get("damageRemarks"),
    missingAccessories: formData.get("missingAccessories"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const asset = await getAssetById(parsed.data.assetId);
  if (!asset) {
    return { error: "Asset not found." };
  }
  const result = await insertReturn(companyId, user.id, asset.allottedTo, parsed.data);
  if ("error" in result) {
    return { error: result.error };
  }
  const update = await updateAssetCustody({
    assetId: asset.id,
    allottedTo: null,
    allotmentDate: null,
    condition: parsed.data.conditionKey ?? asset.condition,
  });
  if (update.error) {
    return { error: update.error };
  }
  await insertLifecycleEvent({
    companyId,
    assetId: asset.id,
    eventType: "return",
    summary: "Returned to store",
    actorId: user.id,
  });
  await writeAuditLog({ action: "asset.return", entityType: "asset", entityId: asset.id });
  await dispatchEventEmail({
    companyId,
    eventKey: "asset_returned",
    entityId: asset.id,
    occurrenceKey: `return:${result.id}`,
    vars: { asset_name: asset.name, asset_code: asset.assetCode, asset_url: `${appUrl()}/assets/${asset.id}` },
  });
  revalidatePath(`/assets/${asset.id}`);
  return { error: null, success: "Return recorded." };
}

export async function transferAssetAction(
  _prev: CustodyFormState,
  formData: FormData,
): Promise<CustodyFormState> {
  if (!(await requireWritableTenant())) {
    return { error: TENANT_READ_ONLY_MESSAGE };
  }
  if (!(await requireModule("transfers")) || !(await requirePermission("handover", "transfer"))) {
    return { error: "You don't have permission to transfer assets." };
  }
  const companyId = headers().get(TENANT_HEADERS.companyId);
  const user = await getRequestAuthUser();
  if (!companyId || !user) {
    return { error: "Could not determine your company." };
  }
  const parsed = transferSchema.safeParse({
    assetId: formData.get("assetId"),
    toUserId: formData.get("toUserId"),
    toLocationId: formData.get("toLocationId"),
    transferredAt: formData.get("transferredAt"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const asset = await getAssetById(parsed.data.assetId);
  if (!asset) {
    return { error: "Asset not found." };
  }
  const runtime = await getWorkspaceRuntime();
  const requiresAck = Boolean(parsed.data.toUserId) && runtime.workflows.transfer_approval;
  const result = await insertTransfer(companyId, user.id, asset.allottedTo, asset.locationId, parsed.data, {
    immediate: !requiresAck,
  });
  if ("error" in result) {
    return { error: result.error };
  }

  const vars = { asset_name: asset.name, asset_code: asset.assetCode, asset_url: `${appUrl()}/assets/${asset.id}` };

  if (!requiresAck) {
    if (parsed.data.toLocationId && parsed.data.toLocationId !== asset.locationId) {
      const fromPath = asset.locationId ? await getLocationPath(asset.locationId) : null;
      const toPath = await getLocationPath(parsed.data.toLocationId);
      await recordAssetLocationMove({
        companyId,
        assetId: asset.id,
        userId: user.id,
        fromLocationId: asset.locationId,
        toLocationId: parsed.data.toLocationId,
        fromLocationPath: fromPath,
        toLocationPath: toPath,
      });
    }
    const nextCustodian = parsed.data.toUserId ?? asset.allottedTo;
    const update = await updateAssetCustody({
      assetId: asset.id,
      allottedTo: nextCustodian,
      allotmentDate: parsed.data.toUserId ? parsed.data.transferredAt : asset.allotmentDate,
      locationId: parsed.data.toLocationId,
    });
    if (update.error) {
      return { error: update.error };
    }
    await insertLifecycleEvent({
      companyId,
      assetId: asset.id,
      eventType: "transfer",
      summary: parsed.data.toUserId ? "Transfer completed" : "Location transfer completed",
      actorId: user.id,
    });
    await writeAuditLog({ action: "asset.transfer", entityType: "asset", entityId: asset.id });
    await dispatchEventEmail({
      companyId,
      eventKey: "asset_transferred",
      entityId: asset.id,
      occurrenceKey: `transfer:${result.id}`,
      vars,
    });
    revalidatePath(`/assets/${asset.id}`);
    return { error: null, success: "Transfer recorded." };
  }

  await insertLifecycleEvent({
    companyId,
    assetId: asset.id,
    eventType: "transfer_pending",
    summary: "Transfer requested — waiting for acknowledgement",
    actorId: user.id,
  });
  await writeAuditLog({ action: "asset.transfer_requested", entityType: "asset", entityId: asset.id });

  const supabase = createClient();
  const { data: recipient } = await supabase
    .from("users")
    .select("email, full_name")
    .eq("id", parsed.data.toUserId)
    .maybeSingle<{ email: string; full_name: string | null }>();
  await dispatchEventEmail({
    companyId,
    eventKey: "transfer_pending",
    entityId: asset.id,
    occurrenceKey: `transfer-pending:${result.id}`,
    extraRecipients: recipient?.email ? [{ email: recipient.email, name: recipient.full_name }] : [],
    vars,
  });
  revalidatePath(`/assets/${asset.id}`);
  return { error: null, success: "Transfer sent for acknowledgement." };
}

export async function acceptTransferAction(transferId: string): Promise<CustodyFormState> {
  if (!(await requireWritableTenant())) {
    return { error: TENANT_READ_ONLY_MESSAGE };
  }
  if (!(await requireModule("transfers"))) {
    return { error: "Transfers are disabled for this company." };
  }
  const user = await getRequestAuthUser();
  const companyId = headers().get(TENANT_HEADERS.companyId);
  if (!user || !companyId) {
    return { error: "You must be signed in." };
  }
  const transfer = await getTransferById(transferId);
  if (!transfer || transfer.status !== "pending") {
    return { error: "This transfer is not waiting for acknowledgement." };
  }
  if (transfer.toUserId !== user.id) {
    return { error: "Only the receiving user can accept this transfer." };
  }
  const asset = await getAssetById(transfer.assetId);
  if (!asset) {
    return { error: "Asset not found." };
  }
  const accepted = await acceptTransfer(transferId, user.id);
  if (accepted.error) {
    return { error: accepted.error };
  }
  if (transfer.toLocationId && transfer.toLocationId !== asset.locationId) {
    const fromPath = asset.locationId ? await getLocationPath(asset.locationId) : null;
    const toPath = await getLocationPath(transfer.toLocationId);
    await recordAssetLocationMove({
      companyId,
      assetId: asset.id,
      userId: user.id,
      fromLocationId: asset.locationId,
      toLocationId: transfer.toLocationId,
      fromLocationPath: fromPath,
      toLocationPath: toPath,
    });
  }
  const update = await updateAssetCustody({
    assetId: asset.id,
    allottedTo: transfer.toUserId,
    allotmentDate: transfer.transferredAt,
    locationId: transfer.toLocationId ?? undefined,
  });
  if (update.error) {
    return { error: update.error };
  }
  await insertLifecycleEvent({
    companyId,
    assetId: asset.id,
    eventType: "transfer_accepted",
    summary: "Transfer accepted",
    actorId: user.id,
  });
  await writeAuditLog({
    action: "asset.transfer_accepted",
    entityType: "asset",
    entityId: asset.id,
    oldValues: { allottedTo: transfer.fromUserId },
    newValues: { allottedTo: transfer.toUserId },
  });
  await dispatchEventEmail({
    companyId,
    eventKey: "transfer_accepted",
    entityId: asset.id,
    occurrenceKey: `transfer-accepted:${transfer.id}`,
    vars: { asset_name: asset.name, asset_code: asset.assetCode, asset_url: `${appUrl()}/assets/${asset.id}` },
  });
  revalidatePath(`/assets/${asset.id}`);
  return { error: null, success: "Transfer accepted." };
}

export async function rejectTransferAction(transferId: string, formData?: FormData): Promise<CustodyFormState> {
  if (!(await requireWritableTenant())) {
    return { error: TENANT_READ_ONLY_MESSAGE };
  }
  if (!(await requireModule("transfers"))) {
    return { error: "Transfers are disabled for this company." };
  }
  const user = await getRequestAuthUser();
  const companyId = headers().get(TENANT_HEADERS.companyId);
  if (!user || !companyId) {
    return { error: "You must be signed in." };
  }
  const transfer = await getTransferById(transferId);
  if (!transfer || transfer.status !== "pending") {
    return { error: "This transfer is not waiting for acknowledgement." };
  }
  if (transfer.toUserId !== user.id) {
    return { error: "Only the receiving user can reject this transfer." };
  }
  const reason = String(formData?.get("reason") ?? "").trim() || undefined;
  const rejected = await rejectTransfer(transferId, user.id, reason);
  if (rejected.error) {
    return { error: rejected.error };
  }
  const asset = await getAssetById(transfer.assetId);
  if (!asset) {
    return { error: "Asset not found." };
  }
  await insertLifecycleEvent({
    companyId,
    assetId: asset.id,
    eventType: "transfer_rejected",
    summary: reason ? `Transfer rejected: ${reason}` : "Transfer rejected",
    actorId: user.id,
  });
  await writeAuditLog({ action: "asset.transfer_rejected", entityType: "asset", entityId: asset.id });
  await dispatchEventEmail({
    companyId,
    eventKey: "transfer_rejected",
    entityId: asset.id,
    occurrenceKey: `transfer-rejected:${transfer.id}`,
    vars: { asset_name: asset.name, asset_code: asset.assetCode, asset_url: `${appUrl()}/assets/${asset.id}` },
  });
  revalidatePath(`/assets/${asset.id}`);
  return { error: null, success: "Transfer rejected." };
}

export async function disposeAssetAction(
  _prev: CustodyFormState,
  formData: FormData,
): Promise<CustodyFormState> {
  if (!(await requireWritableTenant())) {
    return { error: TENANT_READ_ONLY_MESSAGE };
  }
  if (!(await requireModule("disposal"))) {
    return { error: "Disposal is disabled for this company." };
  }
  const runtime = await getWorkspaceRuntime();
  const disposeAction: PermissionAction = runtime.workflows.disposal_approval ? "dispose" : "edit";
  if (!(await requirePermission("assets", disposeAction))) {
    return { error: "You don't have permission to dispose assets." };
  }
  const companyId = headers().get(TENANT_HEADERS.companyId);
  const user = await getRequestAuthUser();
  if (!companyId || !user) {
    return { error: "Could not determine your company." };
  }
  const parsed = disposeSchema.safeParse({
    assetId: formData.get("assetId"),
    statusId: formData.get("statusId"),
    disposedAt: formData.get("disposedAt"),
    reason: formData.get("reason"),
    value: formData.get("value"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const asset = await getAssetById(parsed.data.assetId);
  if (!asset) {
    return { error: "Asset not found." };
  }
  const missing = await listMissingRequiredDocuments(asset.id);
  if (missing.length > 0) {
    return { error: `Upload required documents first: ${missing.map((doc) => doc.name).join(", ")}.` };
  }
  const supabase = createClient();
  const { data: status } = await supabase
    .from("asset_statuses")
    .select("id, is_final, name")
    .eq("id", parsed.data.statusId)
    .maybeSingle<{ id: string; is_final: boolean; name: string }>();
  if (!status?.is_final) {
    return { error: "Choose a final (disposed) status." };
  }
  const update = await updateAssetStatus(asset.id, status.id);
  if (update.error) {
    return { error: update.error };
  }
  await insertLifecycleEvent({
    companyId,
    assetId: asset.id,
    eventType: "disposal",
    summary: `Disposed (${status.name}): ${parsed.data.reason}`,
    actorId: user.id,
    payload: { disposedAt: parsed.data.disposedAt, value: parsed.data.value ?? null },
  });
  await writeAuditLog({ action: "asset.disposed", entityType: "asset", entityId: asset.id, newValues: parsed.data });
  revalidatePath(`/assets/${asset.id}`);
  return { error: null, success: "Disposal recorded." };
}
