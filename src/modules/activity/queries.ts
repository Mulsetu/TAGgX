import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { AuditLogEntry } from "./types";

interface AuditLogRow {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  actor_id: string | null;
  created_at: string;
  old_values: unknown;
  new_values: unknown;
}

export async function listAuditLog(limit = 50): Promise<AuditLogEntry[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("audit_log")
    .select("id, action, entity_type, entity_id, actor_id, created_at, old_values, new_values")
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<AuditLogRow[]>();

  return (data ?? []).map((row) => ({
    id: row.id,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    actorId: row.actor_id,
    createdAt: row.created_at,
    oldValues: row.old_values,
    newValues: row.new_values,
  }));
}
