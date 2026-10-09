import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ConditionOption, ConditionSummary } from "./types";

interface ConditionRow {
  id: string;
  key: string;
  name: string;
  color: string | null;
  sort_order: number;
  is_system: boolean;
  is_active: boolean;
  created_at: string;
}

function mapRow(row: ConditionRow): ConditionSummary {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    color: row.color,
    sortOrder: row.sort_order,
    isSystem: row.is_system,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

export async function listConditions(): Promise<ConditionSummary[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("asset_conditions")
    .select("id, key, name, color, sort_order, is_system, is_active, created_at")
    .order("sort_order")
    .returns<ConditionRow[]>();

  if (error || !data) {
    return [];
  }

  return data.map(mapRow);
}

export async function listActiveConditionOptions(): Promise<ConditionOption[]> {
  const conditions = await listConditions();
  return conditions.filter((row) => row.isActive).map((row) => ({ key: row.key, name: row.name }));
}

/** Assets per condition key (assets.condition stores the key, not an id). */
export async function countAssetsPerCondition(keys: string[]): Promise<Record<string, number>> {
  const supabase = createClient();
  const counts = await Promise.all(
    keys.map(async (key) => {
      const { count } = await supabase.from("assets").select("id", { count: "exact", head: true }).eq("condition", key);
      return [key, count ?? 0] as const;
    }),
  );
  return Object.fromEntries(counts);
}
