"use server";

import "server-only";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { TENANT_HEADERS } from "@/lib/tenant";
import { requirePermission } from "@/lib/permissions/has-permission";
import { TENANT_READ_ONLY_MESSAGE, requireWritableTenant } from "@/lib/permissions/tenant-access";
import { requireModule } from "@/lib/permissions/features";
import { writeAuditLog } from "@/lib/audit-log";
import { listActiveVendorOptions, listVendors } from "./queries";
import { createVendor, updateVendor } from "./mutations";
import { vendorFormSchema } from "./validation";
import type { VendorFormState, VendorOption, VendorSummary } from "./types";

const PATH = "/dashboard/administration/vendors";

export async function getVendorsForAdmin(): Promise<VendorSummary[]> {
  if (!(await requireModule("vendors")) || !(await requirePermission("vendors", "view"))) {
    return [];
  }
  return listVendors();
}

export async function getVendorOptions(): Promise<VendorOption[]> {
  if (!(await requireModule("vendors"))) {
    return [];
  }
  return listActiveVendorOptions();
}

function readVendor(formData: FormData) {
  return {
    name: formData.get("name"),
    companyName: formData.get("companyName"),
    contactName: formData.get("contactName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    address: formData.get("address"),
    serviceCategory: formData.get("serviceCategory"),
    isActive: formData.get("isActive") === "on",
    notes: formData.get("notes"),
  };
}

export async function createVendorAction(_prev: VendorFormState, formData: FormData): Promise<VendorFormState> {
  if (!(await requireWritableTenant())) {
    return { error: TENANT_READ_ONLY_MESSAGE };
  }
  if (!(await requireModule("vendors")) || !(await requirePermission("vendors", "create"))) {
    return { error: "You don't have permission to create vendors." };
  }
  const companyId = headers().get(TENANT_HEADERS.companyId);
  if (!companyId) {
    return { error: "Could not determine your company." };
  }
  const parsed = vendorFormSchema.safeParse(readVendor(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const result = await createVendor(companyId, parsed.data);
  if ("error" in result) {
    return { error: result.error };
  }
  await writeAuditLog({ action: "vendor.created", entityType: "vendor", entityId: result.id });
  revalidatePath(PATH);
  return { error: null };
}

export async function updateVendorAction(id: string, _prev: VendorFormState, formData: FormData): Promise<VendorFormState> {
  if (!(await requireWritableTenant())) {
    return { error: TENANT_READ_ONLY_MESSAGE };
  }
  if (!(await requireModule("vendors")) || !(await requirePermission("vendors", "edit"))) {
    return { error: "You don't have permission to edit vendors." };
  }
  const parsed = vendorFormSchema.safeParse(readVendor(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const result = await updateVendor(id, parsed.data);
  if (result.error) {
    return { error: result.error };
  }
  await writeAuditLog({ action: "vendor.updated", entityType: "vendor", entityId: id });
  revalidatePath(PATH);
  return { error: null };
}
