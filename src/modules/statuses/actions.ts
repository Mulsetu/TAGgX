"use server";

import "server-only";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { TENANT_HEADERS } from "@/lib/tenant";
import { requirePermission } from "@/lib/permissions/has-permission";
import { TENANT_READ_ONLY_MESSAGE, requireWritableTenant } from "@/lib/permissions/tenant-access";
import { writeAuditLog } from "@/lib/audit-log";
import { clientIpFromHeaders, consumeRateLimit } from "@/lib/rate-limit";
import { countAssetsPerStatus, listStatuses } from "./queries";
import { createStatus, deleteStatus, reassignStatusAssets, reorderStatuses, updateStatus } from "./mutations";
import { reorderSchema, replacementSchema, statusFormSchema } from "./validation";
import type { StatusFormState, StatusSummary } from "./types";

const ADMIN_PATH = "/dashboard/administration/statuses";

export async function getStatusesForAdmin(): Promise<StatusSummary[]> {
  if (!(await requirePermission("statuses", "view"))) {
    return [];
  }
  return listStatuses();
}

function readStatusFormData(formData: FormData) {
  return {
    name: formData.get("name"),
    sortOrder: formData.get("sortOrder"),
    color: formData.get("color"),
    isFinal: formData.get("isFinal") === "on" || formData.get("isFinal") === "true",
    allowsAssignment: formData.get("allowsAssignment") === "on" || formData.get("allowsAssignment") === "true",
  };
}

export async function createStatusAction(
  _prevState: StatusFormState,
  formData: FormData,
): Promise<StatusFormState> {
  if (!(await requireWritableTenant())) {
    return { error: TENANT_READ_ONLY_MESSAGE };
  }
  if (!(await requirePermission("statuses", "create"))) {
    return { error: "You don't have permission to create statuses." };
  }

  const companyId = headers().get(TENANT_HEADERS.companyId);
  if (!companyId) {
    return { error: "Could not determine your company." };
  }

  const parsed = statusFormSchema.safeParse(readStatusFormData(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const result = await createStatus(companyId, parsed.data);
  if ("error" in result) {
    return { error: result.error };
  }

  await writeAuditLog({ action: "status.created", entityType: "asset_status", entityId: result.id, newValues: parsed.data });
  revalidatePath(ADMIN_PATH);
  return { error: null };
}

export async function updateStatusAction(
  id: string,
  _prevState: StatusFormState,
  formData: FormData,
): Promise<StatusFormState> {
  if (!(await requireWritableTenant())) {
    return { error: TENANT_READ_ONLY_MESSAGE };
  }
  if (!(await requirePermission("statuses", "edit"))) {
    return { error: "You don't have permission to edit statuses." };
  }

  const parsed = statusFormSchema.safeParse(readStatusFormData(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const result = await updateStatus(id, parsed.data);
  if ("error" in result) {
    return { error: result.error };
  }

  revalidatePath(ADMIN_PATH);
  return { error: null };
}

/** How many assets use each status — drives the counts and safe delete. */
export async function getStatusUsageForAdmin(): Promise<Record<string, number>> {
  if (!(await requirePermission("statuses", "view"))) {
    return {};
  }
  const statuses = await listStatuses();
  return countAssetsPerStatus(statuses.map((status) => status.id));
}

/**
 * Deletes a status. If assets still use it, `replacementId` moves them to
 * another status first (assets.status_id is ON DELETE RESTRICT).
 */
export async function deleteStatusAction(id: string, replacementId?: string): Promise<{ error: string | null }> {
  if (!(await requireWritableTenant())) {
    return { error: TENANT_READ_ONLY_MESSAGE };
  }
  if (!(await requirePermission("statuses", "delete"))) {
    return { error: "You don't have permission to delete statuses." };
  }
  if (!consumeRateLimit(`setup-delete:${clientIpFromHeaders(headers())}`, 30, 60_000)) {
    return { error: "Too many requests. Wait a minute and try again." };
  }
  const replacement = replacementSchema.safeParse(replacementId);
  if (!replacement.success || replacement.data === id) {
    return { error: "Choose a different status to move the assets to." };
  }

  if (replacement.data) {
    if (!(await requirePermission("assets", "edit"))) {
      return { error: "You need asset edit access to move assets to another status." };
    }
    const statuses = await listStatuses();
    if (!statuses.some((status) => status.id === replacement.data)) {
      return { error: "That status no longer exists." };
    }
    const moved = await reassignStatusAssets(id, replacement.data);
    if (moved.error) {
      return moved;
    }
  }

  const result = await deleteStatus(id);
  if (!result.error) {
    await writeAuditLog({ action: "status.deleted", entityType: "asset_status", entityId: id, newValues: { movedTo: replacement.data ?? null } });
  }
  revalidatePath(ADMIN_PATH);
  revalidatePath("/assets");
  return result;
}

export async function reorderStatusesAction(ids: string[]): Promise<{ error: string | null }> {
  if (!(await requireWritableTenant())) {
    return { error: TENANT_READ_ONLY_MESSAGE };
  }
  if (!(await requirePermission("statuses", "edit"))) {
    return { error: "You don't have permission to edit statuses." };
  }
  const parsed = reorderSchema.safeParse(ids);
  if (!parsed.success) {
    return { error: "Invalid order." };
  }
  const result = await reorderStatuses(parsed.data);
  revalidatePath(ADMIN_PATH);
  return result;
}
