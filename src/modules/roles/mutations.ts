import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { FULL_PERMISSIONS, AUDITOR_PERMISSIONS, TECHNICIAN_PERMISSIONS, VIEWER_PERMISSIONS, type PermissionsMap } from "@/lib/permissions/taxonomy";

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

  // Runs through the update_role_permissions() RPC (migration 0048), not a
  // direct table update: RLS no longer grants authenticated a column-level
  // UPDATE on `permissions`, and the RPC re-checks is_system = false and
  // roles.edit permission itself — the seeded "Admin" role always keeps
  // full access so a company can never lock itself out, regardless of
  // what a tampered client request claims.
  const { error } = await supabase.rpc("update_role_permissions", {
    p_role_id: roleId,
    p_permissions: permissions,
  });

  if (error) {
    return { error: "Could not update permissions — the Company Admin role can't be changed." };
  }

  return { id: roleId };
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
    return { error: "The Company Admin role can't be deleted." };
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
      name: "Company Admin",
      description: "Full company administrator. Product access does not depend on this permission matrix.",
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

export async function seedDefaultCompanyRoles(companyId: string): Promise<{ error: string | null }> {
  const supabase = createAdminClient();
  const seeds = [
    {
      name: "Auditor",
      description: "Physical audits and floor scanning.",
      permissions: AUDITOR_PERMISSIONS,
    },
    {
      name: "Technician",
      description: "Maintenance tickets and assigned assets.",
      permissions: TECHNICIAN_PERMISSIONS,
    },
    {
      name: "Viewer",
      description: "Read-only asset and report access.",
      permissions: VIEWER_PERMISSIONS,
    },
  ];

  for (const seed of seeds) {
    const { error } = await supabase.from("roles").insert({
      company_id: companyId,
      name: seed.name,
      description: seed.description,
      is_system: false,
      permissions: seed.permissions,
    });
    if (error && error.code !== "23505") {
      return { error: "Could not seed default roles." };
    }
  }

  return { error: null };
}

/**
 * Copies a source role's permissions onto a new row via the
 * duplicate_role() RPC (migration 0048): an insert grant covering
 * `permissions` directly would let any authenticated caller POST a role
 * with any permissions they like, so the copy happens server-side, where
 * the source role's company and the caller's roles.create permission are
 * both re-checked first. `companyId` isn't needed here — the RPC scopes
 * the insert to the caller's own company.
 */
export async function duplicateRole(
  _companyId: string,
  sourceRoleId: string,
  name: string,
): Promise<RoleMutationResult> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc("duplicate_role", {
    p_source_role_id: sourceRoleId,
    p_name: name,
  });

  if (error || !data) {
    return {
      error: error?.code === "23505" ? "A role with this name already exists." : "Could not duplicate the role.",
    };
  }

  return { id: data as string };
}
