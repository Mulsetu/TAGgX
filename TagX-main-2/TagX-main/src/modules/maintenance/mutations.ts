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
