import "server-only";
import { createClient } from "@/lib/supabase/server";
import { ACTIVITY_AREA_PREFIXES, type ActivityArea, type AuditLogPage } from "./types";

const PAGE_SIZE = 25;

type ActorRef = { full_name: string | null; email: string } | { full_name: string | null; email: string }[] | null;

interface AuditLogRow {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  actor_id: string | null;
  created_at: string;
  old_values: unknown;
  new_values: unknown;
  actor: ActorRef;
}

function actorName(actor: ActorRef): string | null {
  const row = Array.isArray(actor) ? actor[0] : actor;
  return row ? (row.full_name ?? row.email) : null;
}

/** One page of the caller's company audit trail (RLS-scoped), optionally narrowed to an area. */
export async function listAuditLog(area: ActivityArea, page: number): Promise<AuditLogPage> {
  const supabase = createClient();
  const from = (page - 1) * PAGE_SIZE;

  let query = supabase
    .from("audit_log")
    .select(
      "id, action, entity_type, entity_id, actor_id, created_at, old_values, new_values, actor:users!audit_log_actor_id_fkey(full_name, email)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false });

  if (area !== "all") {
    // Prefixes are fixed constants (no user input), so building the filter string is safe.
    const prefixes = ACTIVITY_AREA_PREFIXES[area];
    query = query.or(prefixes.map((prefix) => `action.like.${prefix}*`).join(","));
  }

  const { data, count } = await query.range(from, from + PAGE_SIZE - 1).returns<AuditLogRow[]>();

  return {
    items: (data ?? []).map((row) => ({
      id: row.id,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      actorId: row.actor_id,
      actorName: actorName(row.actor),
      createdAt: row.created_at,
      oldValues: row.old_values,
      newValues: row.new_values,
    })),
    totalCount: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
    area,
  };
}
