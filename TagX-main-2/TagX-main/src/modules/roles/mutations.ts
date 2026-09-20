import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { FULL_PERMISSIONS, type PermissionsMap } from "@/lib/permissions/taxonomy";

export type RoleMutationResult = { id: string } | { error: string };

export async function createRole(
  companyId: string,
  name: string,
  description: string | undefined,
): Promise<RoleMutationResult> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("roles")
    .insert({ company_id: companyId, name, description: description ?? null })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    return {
      error: error?.code === "23505" ? "A role with this name already exists." : "Could not create the role.",
    };
  }

  return { id: data.id };
}

export async function updateRolePermissions(
  roleId: string,
  permissions: PermissionsMap,
): Promise<RoleMutationResult> {
  const supabase = createClient();

  // is_system = false in the filter, not just the UI: the seeded "Admin"
  // role always keeps full access so a company can never lock itself out,
  // regardless of what a tampered client request claims.
  const { data, error } = await supabase
    .from("roles")
    .update({ permissions })
    .eq("id", roleId)
    .eq("is_system", false)
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    return { error: "Could not update permissions — the default Admin role can't be changed." };
  }

  return { id: data.id };
}

export async function deleteRole(roleId: string): Promise<{ error: string | null }> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("roles")
    .delete()
    .eq("id", roleId)
    .eq("is_system", false)
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error) {
    // users.role_id -> roles(id) is ON DELETE RESTRICT, so this is almost
    // always "someone's still assigned this role."
    return { error: "Can't delete a role that's still assigned to a user." };
  }

  if (!data) {
    return { error: "The default Admin role can't be deleted." };
  }

  return { error: null };
}

/**
 * Seeds the default, full-permission "Admin" role for a brand-new
 * company. Uses the service-role client deliberately: this runs at
 * company-creation time (see modules/companies/mutations.ts's
 * createCompany), before anyone has a session scoped to the new company
 * for RLS to key off of.
 */
export async function createSystemAdminRole(companyId: string): Promise<RoleMutationResult> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("roles")
    .insert({
      company_id: companyId,
      name: "Admin",
      description: "Full access to this company's TagX workspace.",
      is_system: true,
      permissions: FULL_PERMISSIONS,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    return { error: "Could not create the default role." };
  }

  return { id: data.id };
}
