"use server";

import "server-only";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { TENANT_HEADERS } from "@/lib/tenant";
import { requirePermission } from "@/lib/permissions/has-permission";
import { TENANT_READ_ONLY_MESSAGE, requireWritableTenant } from "@/lib/permissions/tenant-access";
import { writeAuditLog } from "@/lib/audit-log";
import { clientIpFromHeaders, consumeRateLimit } from "@/lib/rate-limit";
import { countAssetsPerCondition, listActiveConditionOptions, listConditions } from "./queries";
import { createCondition, deleteCondition, reassignConditionKey, reorderConditions, updateCondition } from "./mutations";
import { conditionFormSchema, reorderSchema, replacementSchema } from "./validation";
import type { ConditionFormState, ConditionOption, ConditionSummary } from "./types";

const ADMIN_PATH = "/dashboard/administration/conditions";

export async function getConditionsForAdmin(): Promise<ConditionSummary[]> {
  if (!(await requirePermission("statuses", "view"))) {
    return [];
  }
  return listConditions();
}

export async function getActiveConditionOptions(): Promise<ConditionOption[]> {
  if (!(await requirePermission("statuses", "view")) && !(await requirePermission("assets", "view"))) {
    return [];
  }
  return listActiveConditionOptions();
}

function readForm(formData: FormData) {
  return {
    key: formData.get("key"),
    name: formData.get("name"),
    color: formData.get("color"),
    sortOrder: formData.get("sortOrder"),
    isActive: formData.get("isActive") === "on" || formData.get("isActive") === "true",
  };
}

export async function createConditionAction(
  _prevState: ConditionFormState,
  formData: FormData,
): Promise<ConditionFormState> {
  if (!(await requireWritableTenant())) {
    return { error: TENANT_READ_ONLY_MESSAGE };
  }
  if (!(await requirePermission("statuses", "create"))) {
    return { error: "You don't have permission to create conditions." };
  }

  const companyId = headers().get(TENANT_HEADERS.companyId);
  if (!companyId) {
    return { error: "Could not determine your company." };
  }

  const parsed = conditionFormSchema.safeParse(readForm(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const result = await createCondition(companyId, parsed.data);
  if ("error" in result) {
    return { error: result.error };
  }

  await writeAuditLog({
    action: "condition.created",
    entityType: "asset_condition",
    entityId: result.id,
    newValues: parsed.data,
  });
  revalidatePath(ADMIN_PATH);
  return { error: null };
}

export async function updateConditionAction(
  id: string,
  _prevState: ConditionFormState,
  formData: FormData,
): Promise<ConditionFormState> {
  if (!(await requireWritableTenant())) {
    return { error: TENANT_READ_ONLY_MESSAGE };
  }
  if (!(await requirePermission("statuses", "edit"))) {
    return { error: "You don't have permission to edit conditions." };
  }

  const parsed = conditionFormSchema.safeParse(readForm(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const result = await updateCondition(id, parsed.data);
  if ("error" in result) {
    return { error: result.error };
  }

  await writeAuditLog({
    action: "condition.updated",
    entityType: "asset_condition",
    entityId: id,
    newValues: parsed.data,
  });
  revalidatePath(ADMIN_PATH);
  return { error: null };
}

/** Assets per condition id (counted by the condition's key). */
export async function getConditionUsageForAdmin(): Promise<Record<string, number>> {
  if (!(await requirePermission("statuses", "view"))) {
    return {};
  }
  const conditions = await listConditions();
  const byKey = await countAssetsPerCondition(conditions.map((condition) => condition.key));
  return Object.fromEntries(conditions.map((condition) => [condition.id, byKey[condition.key] ?? 0]));
}

/**
 * Deletes a condition. Assets store the condition *key* with no foreign key,
 * so without `replacementId` they'd silently point at nothing — when the
 * condition is in use, the UI requires a replacement.
 */
export async function deleteConditionAction(id: string, replacementId?: string): Promise<{ error: string | null }> {
  if (!(await requireWritableTenant())) {
    return { error: TENANT_READ_ONLY_MESSAGE };
  }
  if (!(await requirePermission("statuses", "delete"))) {
    return { error: "You don't have permission to delete conditions." };
  }
  if (!consumeRateLimit(`setup-delete:${clientIpFromHeaders(headers())}`, 30, 60_000)) {
    return { error: "Too many requests. Wait a minute and try again." };
  }
  const replacement = replacementSchema.safeParse(replacementId);
  if (!replacement.success || replacement.data === id) {
    return { error: "Choose a different condition to move the assets to." };
  }

  const conditions = await listConditions();
  const target = conditions.find((condition) => condition.id === id);
  if (!target) {
    return { error: "Condition not found." };
  }
  if (replacement.data) {
    const to = conditions.find((condition) => condition.id === replacement.data);
    if (!to) {
      return { error: "That condition no longer exists." };
    }
    if (!(await requirePermission("assets", "edit"))) {
      return { error: "You need asset edit access to move assets to another condition." };
    }
    const moved = await reassignConditionKey(target.key, to.key);
    if (moved.error) {
      return moved;
    }
  } else {
    const inUse = (await countAssetsPerCondition([target.key]))[target.key] ?? 0;
    if (inUse > 0) {
      return { error: "Assets still use this condition. Choose one to move them to." };
    }
  }

  const result = await deleteCondition(id);
  if (!result.error) {
    await writeAuditLog({ action: "condition.deleted", entityType: "asset_condition", entityId: id });
  }
  revalidatePath(ADMIN_PATH);
  return result;
}

export async function reorderConditionsAction(ids: string[]): Promise<{ error: string | null }> {
  if (!(await requireWritableTenant())) {
    return { error: TENANT_READ_ONLY_MESSAGE };
  }
  if (!(await requirePermission("statuses", "edit"))) {
    return { error: "You don't have permission to edit conditions." };
  }
  const parsed = reorderSchema.safeParse(ids);
  if (!parsed.success) {
    return { error: "Invalid order." };
  }
  const result = await reorderConditions(parsed.data);
  revalidatePath(ADMIN_PATH);
  return result;
}
