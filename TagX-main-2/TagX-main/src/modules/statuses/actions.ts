"use server";

import "server-only";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { TENANT_HEADERS } from "@/lib/tenant";
import { requirePermission } from "@/lib/permissions/has-permission";
import { listStatuses } from "./queries";
import { createStatus, deleteStatus, updateStatus } from "./mutations";
import { statusFormSchema } from "./validation";
import type { StatusFormState, StatusSummary } from "./types";

const ADMIN_PATH = "/dashboard/administration/statuses";

export async function getStatusesForAdmin(): Promise<StatusSummary[]> {
  return listStatuses();
}

function readStatusFormData(formData: FormData) {
  return {
    name: formData.get("name"),
    sortOrder: formData.get("sortOrder"),
  };
}

export async function createStatusAction(
  _prevState: StatusFormState,
  formData: FormData,
): Promise<StatusFormState> {
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

  revalidatePath(ADMIN_PATH);
  return { error: null };
}

export async function updateStatusAction(
  id: string,
  _prevState: StatusFormState,
  formData: FormData,
): Promise<StatusFormState> {
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

export async function deleteStatusAction(id: string): Promise<{ error: string | null }> {
  if (!(await requirePermission("statuses", "delete"))) {
    return { error: "You don't have permission to delete statuses." };
  }

  const result = await deleteStatus(id);
  revalidatePath(ADMIN_PATH);
  return result;
}
