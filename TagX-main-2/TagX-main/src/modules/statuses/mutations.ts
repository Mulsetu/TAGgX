import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { StatusFormInput } from "./validation";

export type StatusMutationResult = { id: string } | { error: string };

function friendlyError(code: string | undefined): string {
  if (code === "23505") return "A status with this name already exists.";
  return "Could not save the status.";
}

export async function createStatus(
  companyId: string,
  input: StatusFormInput,
): Promise<StatusMutationResult> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("asset_statuses")
    .insert({ company_id: companyId, name: input.name, sort_order: input.sortOrder })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    return { error: friendlyError(error?.code) };
  }

  return { id: data.id };
}

export async function updateStatus(
  id: string,
  input: StatusFormInput,
): Promise<StatusMutationResult> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("asset_statuses")
    .update({ name: input.name, sort_order: input.sortOrder })
    .eq("id", id)
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    return { error: friendlyError(error?.code) };
  }

  return { id: data.id };
}

export async function deleteStatus(id: string): Promise<{ error: string | null }> {
  const supabase = createClient();

  const { error } = await supabase.from("asset_statuses").delete().eq("id", id);

  if (error) {
    // assets.status_id -> asset_statuses(id) is ON DELETE RESTRICT — this
    // is almost always "an asset still uses this status."
    return { error: "Can't delete a status that's still assigned to an asset." };
  }

  return { error: null };
}

const DEFAULT_STATUSES = [
  { name: "active", sortOrder: 1 },
  { name: "in_repair", sortOrder: 2 },
  { name: "retired", sortOrder: 3 },
  { name: "disposed", sortOrder: 4 },
  { name: "lost", sortOrder: 5 },
];

export type SeedStatusesResult = { error: string | null };

/**
 * Seeds the same 5 statuses every company used to get for free from the
 * old fixed enum (see supabase/migrations/0023_asset_statuses.sql, which
 * backfilled these for every company that existed before status became
 * configurable). Called once at company-creation time, mirroring
 * createSystemAdminRole. Service-role client: runs before anyone has a
 * session scoped to the new company for RLS to key off of.
 */
export async function seedDefaultAssetStatuses(companyId: string): Promise<SeedStatusesResult> {
  const supabase = createAdminClient();

  const { error } = await supabase.from("asset_statuses").insert(
    DEFAULT_STATUSES.map((status) => ({
      company_id: companyId,
      name: status.name,
      sort_order: status.sortOrder,
      is_system: true,
    })),
  );

  if (error) {
    return { error: "Could not seed default statuses." };
  }

  return { error: null };
}
