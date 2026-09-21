import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { MaintenancePlanSummary, MaintenanceTicketSummary, StaleTicketReminder } from "./types";

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
  vendor_id: string | null;
  priority: MaintenanceTicketSummary["priority"];
  due_at: string | null;
  type_key: string;
}

/** Every maintenance ticket for the caller's own company (RLS-scoped), for the admin page. */
export async function listMaintenanceTickets(): Promise<MaintenanceTicketSummary[]> {
  const supabase = createClient();

  // Explicit cap: PostgREST's own default row limit is a project setting,
  // not something this code should depend on silently. Tickets accumulate
  // indefinitely (there's no archival step), so this is the one most
  // likely to actually hit a limit — ordered newest-first so a company
  // past the cap still sees its live/recent tickets, just not the oldest
  // resolved history.
  const { data, error } = await supabase
    .from("maintenance_tickets")
    .select(
      "id, title, description, status, asset_id, assigned_to, opened_at, resolved_at, reporter_name, reporter_email, vendor_id, priority, due_at, type_key, asset:assets(name, asset_code), reported_by_user:users!maintenance_tickets_reported_by_fkey(full_name, email), assigned_to_user:users!maintenance_tickets_assigned_to_fkey(full_name, email)",
    )
    .order("opened_at", { ascending: false })
    .limit(2000)
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
      vendorId: row.vendor_id,
      priority: row.priority,
      dueAt: row.due_at,
      typeKey: row.type_key,
      openedAt: row.opened_at,
      resolvedAt: row.resolved_at,
    }));
}

/** How many public QR reports this email has filed on an asset recently (rate limit). */
export async function countRecentPublicReports(
  assetId: string,
  email: string,
  sinceIso: string,
): Promise<number | null> {
  const supabase = createAdminClient();

  const { count, error } = await supabase
    .from("maintenance_tickets")
    .select("id", { count: "exact", head: true })
    .eq("asset_id", assetId)
    .eq("reporter_email", email)
    .gte("created_at", sinceIso);

  if (error || count === null) {
    return null;
  }

  return count;
}

interface PlanRow {
  id: string;
  name: string;
  asset_id: string;
  frequency: string;
  next_due_at: string;
  is_active: boolean;
  vendor_id: string | null;
  assigned_to: string | null;
  checklist: string | null;
  estimated_cost: number | null;
  instructions: string | null;
  interval_days: number | null;
}

export async function listMaintenancePlans(): Promise<MaintenancePlanSummary[]> {
  const supabase = createClient();
  // Explicit cap: PostgREST's own default row limit is a project setting,
  // not something this code should depend on silently.
  const { data } = await supabase
    .from("maintenance_plans")
    .select("id, name, asset_id, frequency, next_due_at, is_active, vendor_id, assigned_to, checklist, estimated_cost, instructions, interval_days")
    .order("next_due_at")
    .limit(2000)
    .returns<PlanRow[]>();
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    assetId: row.asset_id,
    frequency: row.frequency,
    nextDueAt: row.next_due_at,
    isActive: row.is_active,
    vendorId: row.vendor_id,
    assignedTo: row.assigned_to,
    checklist: row.checklist,
    estimatedCost: row.estimated_cost,
    instructions: row.instructions,
    intervalDays: row.interval_days,
  }));
}

interface DuePlanRow {
  id: string;
  company_id: string;
  asset_id: string;
  name: string;
  frequency: string;
  interval_days: number | null;
  next_due_at: string;
  assigned_to: string | null;
  vendor_id: string | null;
}

export type { DuePlanRow };

export async function listDueMaintenancePlans(asOf: string): Promise<DuePlanRow[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("maintenance_plans")
    .select("id, company_id, asset_id, name, frequency, interval_days, next_due_at, assigned_to, vendor_id")
    .eq("is_active", true)
    .lte("next_due_at", asOf)
    .returns<DuePlanRow[]>();
  return data ?? [];
}

export interface MaintenanceTypeOption {
  key: string;
  name: string;
}

export async function listMaintenanceTypes(): Promise<MaintenanceTypeOption[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("maintenance_types")
    .select("key, name")
    .eq("is_active", true)
    .order("sort_order")
    .returns<MaintenanceTypeOption[]>();
  return data ?? [];
}

interface FinalStatusRow {
  is_final: boolean | null;
}

interface AssetStatusJoinRow {
  id: string;
  name: string;
  asset_statuses: FinalStatusRow | FinalStatusRow[] | null;
}

export async function getAdminAssetForPlan(assetId: string): Promise<{ id: string; name: string; isFinal: boolean } | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("assets")
    .select("id, name, asset_statuses(is_final)")
    .eq("id", assetId)
    .maybeSingle<AssetStatusJoinRow>();
  if (!data) {
    return null;
  }
  const status = Array.isArray(data.asset_statuses) ? data.asset_statuses[0] : data.asset_statuses;
  return { id: data.id, name: data.name, isFinal: status?.is_final === true };
}

export async function planHasTicketForDue(planId: string, dueAt: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("maintenance_tickets")
    .select("id")
    .eq("plan_id", planId)
    .eq("due_at", dueAt)
    .maybeSingle<{ id: string }>();
  return Boolean(data);
}
