import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { StatusSummary } from "./types";

interface StatusRow {
  id: string;
  name: string;
  sort_order: number;
  is_system: boolean;
  color: string | null;
  is_final: boolean;
  allows_assignment: boolean;
  created_at: string;
}

/** Every asset status for the caller's own company (RLS-scoped). */
export async function listStatuses(): Promise<StatusSummary[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("asset_statuses")
    .select("id, name, sort_order, is_system, color, is_final, allows_assignment, created_at")
    .order("sort_order")
    .returns<StatusRow[]>();

  if (error || !data) {
    return [];
  }

  return data.map((row) => ({
    id: row.id,
    name: row.name,
    sortOrder: row.sort_order,
    isSystem: row.is_system,
    color: row.color,
    isFinal: row.is_final,
    allowsAssignment: row.allows_assignment,
    createdAt: row.created_at,
  }));
}
