import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { MaintenanceTicketSummary, StaleTicketReminder } from "./types";

/**
 * Count of tickets currently 'open' or 'in_progress', via the
 * `get_open_maintenance_ticket_count` RPC (see
 * supabase/migrations/0016_dashboard_aggregates.sql). `security invoker`,
 * so RLS already scopes this to the caller's own company.
 */
export async function getOpenMaintenanceTicketCount(): Promise<number> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc("get_open_maintenance_ticket_count");

  if (error || data === null) {
    return 0;
  }

  return Number(data);
}

interface StaleTicketRow {
  id: string;
  company_id: string;
  asset_id: string;
  title: string;
  opened_at: string;
  assets: { name: string; asset_code: string } | null;
}

/**
 * Open/in-progress tickets that have sat unresolved for at least
 * `daysOpen` days, across every company — a system-level scan for the
 * reminder emailer, not scoped to one caller's session, hence the admin
 * client.
 */
export async function getStaleOpenTickets(daysOpen: number): Promise<StaleTicketReminder[]> {
  const supabase = createAdminClient();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysOpen);

  const { data, error } = await supabase
    .from("maintenance_tickets")
    .select("id, company_id, asset_id, title, opened_at, assets(name, asset_code)")
    .in("status", ["open", "in_progress"])
    .lte("opened_at", cutoff.toISOString())
    .returns<StaleTicketRow[]>();

  if (error || !data) {
    return [];
  }

  return data
    .filter((row) => row.assets !== null)
    .map((row) => ({
      ticketId: row.id,
      companyId: row.company_id,
      assetId: row.asset_id,
      assetName: row.assets!.name,
      assetCode: row.assets!.asset_code,
      title: row.title,
      openedAt: row.opened_at,
    }));
}

interface TicketRow {
  id: string;
  title: string;
  description: string | null;
  status: MaintenanceTicketSummary["status"];
  asset_id: string;
  assigned_to: string | null;
  opened_at: string;
  resolved_at: string | null;
  reporter_name: string | null;
  reporter_email: string | null;
  asset: { name: string; asset_code: string } | null;
  reported_by_user: { full_name: string | null; email: string } | null;
  assigned_to_user: { full_name: string | null; email: string } | null;
}

/** Every maintenance ticket for the caller's own company (RLS-scoped), for the admin page. */
export async function listMaintenanceTickets(): Promise<MaintenanceTicketSummary[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("maintenance_tickets")
    .select(
      "id, title, description, status, asset_id, assigned_to, opened_at, resolved_at, reporter_name, reporter_email, asset:assets(name, asset_code), reported_by_user:users!maintenance_tickets_reported_by_fkey(full_name, email), assigned_to_user:users!maintenance_tickets_assigned_to_fkey(full_name, email)",
    )
    .order("opened_at", { ascending: false })
    .returns<TicketRow[]>();

  if (error || !data) {
    return [];
  }

  return data
    .filter((row) => row.asset !== null)
    .map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      status: row.status,
      assetId: row.asset_id,
      assetName: row.asset!.name,
      assetCode: row.asset!.asset_code,
      reportedByName:
        row.reported_by_user?.full_name ??
        row.reported_by_user?.email ??
        row.reporter_name ??
        row.reporter_email ??
        null,
      assignedToId: row.assigned_to,
      assignedToName: row.assigned_to_user?.full_name ?? row.assigned_to_user?.email ?? null,
      openedAt: row.opened_at,
      resolvedAt: row.resolved_at,
    }));
}

/** How many public QR reports this email has filed on an asset recently (rate limit). */
export async function countRecentPublicReports(
  assetId: string,
  email: string,
  sinceIso: string,
): Promise<number> {
  const supabase = createAdminClient();

  const { count, error } = await supabase
    .from("maintenance_tickets")
    .select("id", { count: "exact", head: true })
    .eq("asset_id", assetId)
    .eq("reporter_email", email)
    .gte("created_at", sinceIso);

  if (error || count === null) {
    return 0;
  }

  return count;
}
