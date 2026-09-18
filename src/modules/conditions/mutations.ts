import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ConditionFormInput } from "./validation";

export type ConditionMutationResult = { id: string } | { error: string };

function friendlyError(code: string | undefined): string {
  if (code === "23505") return "A condition with this key already exists.";
  return "Could not save the condition.";
}

export async function createCondition(
  companyId: string,
  input: ConditionFormInput,
): Promise<ConditionMutationResult> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("asset_conditions")
    .insert({
      company_id: companyId,
      key: input.key,
      name: input.name,
      color: input.color ?? null,
      sort_order: input.sortOrder,
      is_active: input.isActive ?? true,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    return { error: friendlyError(error?.code) };
  }

  return { id: data.id };
}

export async function updateCondition(id: string, input: ConditionFormInput): Promise<ConditionMutationResult> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("asset_conditions")
    .update({
      key: input.key,
      name: input.name,
      color: input.color ?? null,
      sort_order: input.sortOrder,
      is_active: input.isActive ?? true,
    })
    .eq("id", id)
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    return { error: friendlyError(error?.code) };
  }

  return { id: data.id };
}

export async function deleteCondition(id: string): Promise<{ error: string | null }> {
  const supabase = createClient();
  const { error } = await supabase.from("asset_conditions").delete().eq("id", id);
  if (error) {
    return { error: "Could not delete the condition." };
  }
  return { error: null };
}

const DEFAULT_CONDITIONS = [
  { key: "new", name: "New", sortOrder: 1 },
  { key: "good", name: "Good", sortOrder: 2 },
  { key: "fair", name: "Fair", sortOrder: 3 },
  { key: "poor", name: "Poor", sortOrder: 4 },
];

export async function seedDefaultAssetConditions(companyId: string): Promise<{ error: string | null }> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("asset_conditions").insert(
    DEFAULT_CONDITIONS.map((condition) => ({
      company_id: companyId,
      key: condition.key,
      name: condition.name,
      sort_order: condition.sortOrder,
      is_system: true,
    })),
  );

  if (error) {
    return { error: "Could not seed default conditions." };
  }
  return { error: null };
}
