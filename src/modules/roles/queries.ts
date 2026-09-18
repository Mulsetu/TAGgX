import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { PermissionsMap } from "@/lib/permissions/taxonomy";
import type { RoleSummary } from "./types";

interface RoleRow {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  permissions: PermissionsMap;
}

/** Every role for the caller's own company (RLS-scoped). */
export async function listRoles(): Promise<RoleSummary[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("roles")
    .select("id, name, description, is_system, permissions")
    .order("name")
    .returns<RoleRow[]>();

  if (error || !data) {
    return [];
  }

  return data.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    isSystem: row.is_system,
    permissions: row.permissions ?? {},
  }));
}
