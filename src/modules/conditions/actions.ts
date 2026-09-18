"use server";

import "server-only";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { TENANT_HEADERS } from "@/lib/tenant";
import { requirePermission } from "@/lib/permissions/has-permission";
import { TENANT_READ_ONLY_MESSAGE, requireWritableTenant } from "@/lib/permissions/tenant-access";
import { writeAuditLog } from "@/lib/audit-log";
import { listActiveConditionOptions, listConditions } from "./queries";
import { createCondition, deleteCondition, updateCondition } from "./mutations";
import { conditionFormSchema } from "./validation";
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

export async function deleteConditionAction(id: string): Promise<{ error: string | null }> {
  if (!(await requireWritableTenant())) {
    return { error: TENANT_READ_ONLY_MESSAGE };
  }
  if (!(await requirePermission("statuses", "delete"))) {
    return { error: "You don't have permission to delete conditions." };
  }

  const result = await deleteCondition(id);
  if (!result.error) {
    await writeAuditLog({ action: "condition.deleted", entityType: "asset_condition", entityId: id });
  }
  revalidatePath(ADMIN_PATH);
  return result;
}
