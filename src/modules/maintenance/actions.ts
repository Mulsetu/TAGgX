"use server";

import "server-only";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { TENANT_HEADERS } from "@/lib/tenant";
import { requirePermission } from "@/lib/permissions/has-permission";
import { TENANT_READ_ONLY_MESSAGE, requireWritableTenant } from "@/lib/permissions/tenant-access";
import { requireModule } from "@/lib/permissions/features";
import { writeAuditLog } from "@/lib/audit-log";
import { dispatchEventEmail } from "@/modules/email/dispatch";
import { getVendorById } from "@/modules/vendors/queries";
import {
  getOpenMaintenanceTicketCount,
  listMaintenancePlans,
  listMaintenanceTickets,
  listMaintenanceTypes,
  type MaintenanceTypeOption,
} from "./queries";
import { createPlan, createTicket, deletePlan, setPlanActive, updatePlan, updateTicket } from "./mutations";
import { createTicketSchema, planFormSchema, updateTicketSchema } from "./validation";
import type { MaintenanceFormState, MaintenancePlanSummary, MaintenanceTicketSummary, OpenTicketCount } from "./types";

const ADMIN_PATH = "/dashboard/administration/maintenance";
const PLANS_PATH = "/dashboard/administration/maintenance/plans";

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "";
}

/** Shaped as a single-entry series for the dashboard's bar chart. */
export async function getOpenMaintenanceTicketsForDashboard(): Promise<OpenTicketCount[]> {
  if (!(await requireModule("maintenance")) || !(await requirePermission("maintenance", "view"))) {
    return [];
  }
  const count = await getOpenMaintenanceTicketCount();
  return [{ label: "Open", count }];
}

export async function getMaintenanceTicketsForAdmin(): Promise<MaintenanceTicketSummary[]> {
  if (!(await requireModule("maintenance")) || !(await requirePermission("maintenance", "view"))) {
    return [];
  }
  return listMaintenanceTickets();
}

export async function getMaintenancePlansForAdmin(): Promise<MaintenancePlanSummary[]> {
  if (!(await requireModule("preventive_maintenance")) || !(await requirePermission("maintenance", "view"))) {
    return [];
  }
  return listMaintenancePlans();
}

export async function getMaintenanceTypesForForm(): Promise<MaintenanceTypeOption[]> {
  if (!(await requireModule("maintenance")) || !(await requirePermission("maintenance", "view"))) {
    return [];
  }
  return listMaintenanceTypes();
}

export async function createTicketAction(
  _prevState: MaintenanceFormState,
  formData: FormData,
): Promise<MaintenanceFormState> {
  if (!(await requireWritableTenant())) {
    return { error: TENANT_READ_ONLY_MESSAGE };
  }
  if (!(await requireModule("maintenance")) || !(await requirePermission("maintenance", "create"))) {
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
    vendorId: formData.get("vendorId"),
    priority: formData.get("priority") || "normal",
    dueAt: formData.get("dueAt"),
    typeKey: formData.get("typeKey") || "corrective",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = createClient();
  const { data: asset } = await supabase
    .from("assets")
    .select("id, name, asset_code")
    .eq("id", parsed.data.assetId)
    .maybeSingle<{ id: string; name: string; asset_code: string }>();
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
    vendorId: parsed.data.vendorId,
    priority: parsed.data.priority,
    dueAt: parsed.data.dueAt,
    typeKey: parsed.data.typeKey,
  });
  if ("error" in result) {
    return { error: result.error };
  }

  await writeAuditLog({ action: "maintenance.created", entityType: "maintenance_ticket", entityId: result.id });

  await dispatchEventEmail({
    companyId,
    eventKey: "maintenance_created",
    entityId: result.id,
    occurrenceKey: `ticket:${result.id}:created`,
    vars: {
      asset_name: asset.name,
      asset_code: asset.asset_code,
      maintenance_title: parsed.data.title,
      vendor_name: "",
      asset_url: `${appUrl()}/assets/${asset.id}`,
    },
  });

  if (parsed.data.vendorId) {
    const vendor = await getVendorById(parsed.data.vendorId);
    await dispatchEventEmail({
      companyId,
      eventKey: "vendor_assigned",
      entityId: result.id,
      occurrenceKey: `ticket:${result.id}:vendor`,
      extraRecipients: vendor?.email ? [{ email: vendor.email, name: vendor.name }] : [],
      vars: {
        asset_name: asset.name,
        asset_code: asset.asset_code,
        maintenance_title: parsed.data.title,
        vendor_name: vendor?.name ?? "",
        asset_url: `${appUrl()}/assets/${asset.id}`,
      },
    });
  }

  revalidatePath(ADMIN_PATH);
  return { error: null };
}

export async function updateTicketAction(
  id: string,
  _prevState: MaintenanceFormState,
  formData: FormData,
): Promise<MaintenanceFormState> {
  if (!(await requireWritableTenant())) {
    return { error: TENANT_READ_ONLY_MESSAGE };
  }
  if (!(await requireModule("maintenance")) || !(await requirePermission("maintenance", "edit"))) {
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

  if (parsed.data.assignedTo) {
    const companyId = headers().get(TENANT_HEADERS.companyId);
    const supabase = createClient();
    const { data: ticket } = await supabase
      .from("maintenance_tickets")
      .select("title, asset_id, assets(name, asset_code), assigned_to_user:users!maintenance_tickets_assigned_to_fkey(email, full_name)")
      .eq("id", id)
      .maybeSingle<{
        title: string;
        asset_id: string;
        assets: { name: string; asset_code: string } | { name: string; asset_code: string }[] | null;
        assigned_to_user: { email: string; full_name: string | null } | { email: string; full_name: string | null }[] | null;
      }>();
    const assetRow = Array.isArray(ticket?.assets) ? ticket.assets[0] : ticket?.assets;
    const assignee = Array.isArray(ticket?.assigned_to_user) ? ticket.assigned_to_user[0] : ticket?.assigned_to_user;
    if (companyId && ticket && assetRow) {
      await dispatchEventEmail({
        companyId,
        eventKey: "maintenance_assigned",
        entityId: id,
        occurrenceKey: `ticket:${id}:assigned:${parsed.data.assignedTo}`,
        extraRecipients: assignee?.email ? [{ email: assignee.email, name: assignee.full_name }] : [],
        vars: {
          asset_name: assetRow.name,
          asset_code: assetRow.asset_code,
          maintenance_title: ticket.title,
          vendor_name: "",
          asset_url: `${appUrl()}/assets/${ticket.asset_id}`,
        },
      });
    }
  }

  revalidatePath(ADMIN_PATH);
  return { error: null };
}

export async function createPlanAction(
  _prevState: MaintenanceFormState,
  formData: FormData,
): Promise<MaintenanceFormState> {
  if (!(await requireWritableTenant())) {
    return { error: TENANT_READ_ONLY_MESSAGE };
  }
  if (!(await requireModule("preventive_maintenance")) || !(await requirePermission("maintenance", "create"))) {
    return { error: "You don't have permission to create maintenance plans." };
  }

  const companyId = headers().get(TENANT_HEADERS.companyId);
  if (!companyId) {
    return { error: "Could not determine your company." };
  }

  const parsed = planFormSchema.safeParse({
    assetId: formData.get("assetId"),
    name: formData.get("name"),
    frequency: formData.get("frequency"),
    intervalDays: formData.get("intervalDays"),
    nextDueAt: formData.get("nextDueAt"),
    vendorId: formData.get("vendorId"),
    assignedTo: formData.get("assignedTo"),
    checklist: formData.get("checklist"),
    estimatedCost: formData.get("estimatedCost"),
    instructions: formData.get("instructions"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = createClient();
  const { data: asset } = await supabase.from("assets").select("id").eq("id", parsed.data.assetId).maybeSingle();
  if (!asset) {
    return { error: "Asset not found." };
  }

  const result = await createPlan(companyId, parsed.data);
  if ("error" in result) {
    return { error: result.error };
  }

  await writeAuditLog({ action: "maintenance_plan.created", entityType: "maintenance_plan", entityId: result.id });
  revalidatePath(PLANS_PATH);
  return { error: null };
}

function readPlanForm(formData: FormData) {
  return {
    assetId: formData.get("assetId"),
    name: formData.get("name"),
    frequency: formData.get("frequency"),
    intervalDays: formData.get("intervalDays"),
    nextDueAt: formData.get("nextDueAt"),
    vendorId: formData.get("vendorId"),
    assignedTo: formData.get("assignedTo"),
    checklist: formData.get("checklist"),
    estimatedCost: formData.get("estimatedCost"),
    instructions: formData.get("instructions"),
  };
}

export async function updatePlanAction(
  id: string,
  _prevState: MaintenanceFormState,
  formData: FormData,
): Promise<MaintenanceFormState> {
  if (!(await requireWritableTenant())) {
    return { error: TENANT_READ_ONLY_MESSAGE };
  }
  if (!(await requireModule("preventive_maintenance")) || !(await requirePermission("maintenance", "edit"))) {
    return { error: "You don't have permission to edit maintenance plans." };
  }
  const parsed = planFormSchema.safeParse(readPlanForm(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const result = await updatePlan(id, parsed.data);
  if ("error" in result) {
    return { error: result.error };
  }
  await writeAuditLog({ action: "maintenance_plan.updated", entityType: "maintenance_plan", entityId: id });
  revalidatePath(PLANS_PATH);
  return { error: null };
}

export async function setPlanActiveAction(id: string, isActive: boolean): Promise<MaintenanceFormState> {
  if (!(await requireWritableTenant())) {
    return { error: TENANT_READ_ONLY_MESSAGE };
  }
  if (!(await requireModule("preventive_maintenance")) || !(await requirePermission("maintenance", "edit"))) {
    return { error: "You don't have permission to edit maintenance plans." };
  }
  const result = await setPlanActive(id, isActive);
  if (result.error) {
    return { error: result.error };
  }
  await writeAuditLog({
    action: isActive ? "maintenance_plan.resumed" : "maintenance_plan.paused",
    entityType: "maintenance_plan",
    entityId: id,
  });
  revalidatePath(PLANS_PATH);
  return { error: null };
}

export async function deletePlanAction(id: string): Promise<MaintenanceFormState> {
  if (!(await requireWritableTenant())) {
    return { error: TENANT_READ_ONLY_MESSAGE };
  }
  if (!(await requireModule("preventive_maintenance")) || !(await requirePermission("maintenance", "delete"))) {
    return { error: "You don't have permission to delete maintenance plans." };
  }
  const result = await deletePlan(id);
  if (result.error) {
    return { error: result.error };
  }
  await writeAuditLog({ action: "maintenance_plan.deleted", entityType: "maintenance_plan", entityId: id });
  revalidatePath(PLANS_PATH);
  return { error: null };
}
