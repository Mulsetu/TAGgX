"use server";

import "server-only";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { TENANT_HEADERS } from "@/lib/tenant";
import { requirePermission } from "@/lib/permissions/has-permission";
import { getOpenMaintenanceTicketCount, listMaintenanceTickets } from "./queries";
import { createTicket, updateTicket } from "./mutations";
import { createTicketSchema, updateTicketSchema } from "./validation";
import type { MaintenanceFormState, MaintenanceTicketSummary, OpenTicketCount } from "./types";

const ADMIN_PATH = "/dashboard/administration/maintenance";

/** Shaped as a single-entry series for the dashboard's bar chart. */
export async function getOpenMaintenanceTicketsForDashboard(): Promise<OpenTicketCount[]> {
  const count = await getOpenMaintenanceTicketCount();
  return [{ label: "Open", count }];
}

export async function getMaintenanceTicketsForAdmin(): Promise<MaintenanceTicketSummary[]> {
  return listMaintenanceTickets();
}

export async function createTicketAction(
  _prevState: MaintenanceFormState,
  formData: FormData,
): Promise<MaintenanceFormState> {
  if (!(await requirePermission("maintenance", "create"))) {
    return { error: "You don't have permission to create maintenance tickets." };
  }

  const companyId = headers().get(TENANT_HEADERS.companyId);
  if (!companyId) {
    return { error: "Could not determine your company." };
  }

  const parsed = createTicketSchema.safeParse({
    assetId: formData.get("assetId"),
    title: formData.get("title"),
    description: formData.get("description"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = createClient();
  const { data: asset } = await supabase.from("assets").select("id").eq("id", parsed.data.assetId).maybeSingle();
  if (!asset) {
    return { error: "Asset not found." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in." };
  }

  const result = await createTicket({
    companyId,
    assetId: parsed.data.assetId,
    title: parsed.data.title,
    description: parsed.data.description,
    reportedBy: user.id,
  });
  if ("error" in result) {
    return { error: result.error };
  }

  revalidatePath(ADMIN_PATH);
  return { error: null };
}

export async function updateTicketAction(
  id: string,
  _prevState: MaintenanceFormState,
  formData: FormData,
): Promise<MaintenanceFormState> {
  if (!(await requirePermission("maintenance", "edit"))) {
    return { error: "You don't have permission to edit maintenance tickets." };
  }

  const parsed = updateTicketSchema.safeParse({
    status: formData.get("status"),
    assignedTo: formData.get("assignedTo"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  if (parsed.data.assignedTo) {
    const supabase = createClient();
    const { data: assignee } = await supabase
      .from("users")
      .select("id")
      .eq("id", parsed.data.assignedTo)
      .maybeSingle();
    if (!assignee) {
      return { error: "Assignee not found." };
    }
  }

  const result = await updateTicket(id, parsed.data.status, parsed.data.assignedTo);
  if ("error" in result) {
    return { error: result.error };
  }

  revalidatePath(ADMIN_PATH);
  return { error: null };
}
