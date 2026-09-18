import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { MaintenanceStatus } from "./types";

export type MaintenanceMutationResult = { id: string } | { error: string };

export async function createTicket(params: {
  companyId: string;
  assetId: string;
  title: string;
  description?: string;
  reportedBy?: string;
  reporterName?: string;
  reporterEmail?: string;
  vendorId?: string;
  priority?: string;
  dueAt?: string;
  typeKey?: string;
  planId?: string;
}): Promise<MaintenanceMutationResult> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("maintenance_tickets")
    .insert({
      company_id: params.companyId,
      asset_id: params.assetId,
      title: params.title,
      description: params.description ?? null,
      reported_by: params.reportedBy ?? null,
      reporter_name: params.reporterName ?? null,
      reporter_email: params.reporterEmail ?? null,
      vendor_id: params.vendorId ?? null,
      priority: params.priority ?? "normal",
      due_at: params.dueAt ?? null,
      type_key: params.typeKey ?? "corrective",
      plan_id: params.planId ?? null,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    return { error: "Could not create the ticket." };
  }

  return { id: data.id };
}

/**
 * Anonymous QR-scan report. Admin client: scanners have no session, and
 * RLS on maintenance_tickets only grants `authenticated` tenant members.
 */
export async function createPublicTicket(params: {
  companyId: string;
  assetId: string;
  title: string;
  description: string;
  reporterName: string;
  reporterEmail: string;
}): Promise<MaintenanceMutationResult> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("maintenance_tickets")
    .insert({
      company_id: params.companyId,
      asset_id: params.assetId,
      title: params.title,
      description: params.description,
      reporter_name: params.reporterName,
      reporter_email: params.reporterEmail,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    return { error: "Could not submit the report." };
  }

  return { id: data.id };
}

export async function updateTicket(
  id: string,
  status: MaintenanceStatus,
  assignedTo?: string,
): Promise<MaintenanceMutationResult> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("maintenance_tickets")
    .update({
      status,
      assigned_to: assignedTo ?? null,
      resolved_at: status === "resolved" || status === "cancelled" ? new Date().toISOString() : null,
    })
    .eq("id", id)
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    return { error: "Could not update the ticket." };
  }

  return { id: data.id };
}

export async function createTicketAdmin(params: {
  companyId: string;
  assetId: string;
  title: string;
  vendorId?: string | null;
  assignedTo?: string | null;
  dueAt: string;
  planId: string;
}): Promise<MaintenanceMutationResult> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("maintenance_tickets")
    .insert({
      company_id: params.companyId,
      asset_id: params.assetId,
      title: params.title,
      vendor_id: params.vendorId ?? null,
      assigned_to: params.assignedTo ?? null,
      due_at: params.dueAt,
      type_key: "preventive",
      plan_id: params.planId,
      priority: "normal",
    })
    .select("id")
    .single<{ id: string }>();
  if (error || !data) {
    return { error: "Could not create the scheduled ticket." };
  }
  return data;
}

export async function createPlan(
  companyId: string,
  input: {
    assetId: string;
    name: string;
    frequency: string;
    intervalDays?: number;
    nextDueAt: string;
    vendorId?: string;
    assignedTo?: string;
    checklist?: string;
    estimatedCost?: number;
    instructions?: string;
  },
): Promise<{ id: string } | { error: string }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("maintenance_plans")
    .insert({
      company_id: companyId,
      asset_id: input.assetId,
      name: input.name,
      frequency: input.frequency,
      interval_days: input.intervalDays ?? null,
      next_due_at: input.nextDueAt,
      vendor_id: input.vendorId ?? null,
      assigned_to: input.assignedTo ?? null,
      checklist: input.checklist ?? null,
      estimated_cost: input.estimatedCost ?? null,
      instructions: input.instructions ?? null,
    })
    .select("id")
    .single<{ id: string }>();
  if (error || !data) {
    return { error: "Could not save the plan." };
  }
  return data;
}

export async function bumpPlanNextDue(planId: string, nextDueAt: string, lastCompletedAt: string): Promise<void> {
  const supabase = createAdminClient();
  await supabase
    .from("maintenance_plans")
    .update({ next_due_at: nextDueAt, last_completed_at: lastCompletedAt })
    .eq("id", planId);
}

export async function updatePlan(
  id: string,
  input: {
    name: string;
    frequency: string;
    intervalDays?: number;
    nextDueAt: string;
    vendorId?: string;
    assignedTo?: string;
    checklist?: string;
    estimatedCost?: number;
    instructions?: string;
  },
): Promise<{ id: string } | { error: string }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("maintenance_plans")
    .update({
      name: input.name,
      frequency: input.frequency,
      interval_days: input.intervalDays ?? null,
      next_due_at: input.nextDueAt,
      vendor_id: input.vendorId ?? null,
      assigned_to: input.assignedTo ?? null,
      checklist: input.checklist ?? null,
      estimated_cost: input.estimatedCost ?? null,
      instructions: input.instructions ?? null,
    })
    .eq("id", id)
    .select("id")
    .maybeSingle<{ id: string }>();
  if (error || !data) {
    return { error: "Could not update the plan." };
  }
  return data;
}

export async function setPlanActive(id: string, isActive: boolean): Promise<{ error: string | null }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("maintenance_plans")
    .update({ is_active: isActive })
    .eq("id", id)
    .select("id")
    .maybeSingle<{ id: string }>();
  if (error || !data) {
    return { error: "Could not update the plan." };
  }
  return { error: null };
}

export async function deletePlan(id: string): Promise<{ error: string | null }> {
  const supabase = createClient();
  const { data, error } = await supabase.from("maintenance_plans").delete().eq("id", id).select("id").maybeSingle<{ id: string }>();
  if (error) {
    return { error: "Could not delete the plan." };
  }
  if (!data) {
    return { error: "Plan not found." };
  }
  return { error: null };
}
