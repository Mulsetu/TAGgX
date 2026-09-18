"use server";

import "server-only";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { TENANT_HEADERS } from "@/lib/tenant";
import { requirePermission, getCurrentUserPermissions, hasPermission } from "@/lib/permissions/has-permission";
import { isCurrentUserSuperAdmin } from "@/lib/permissions/super-admin";
import { TENANT_READ_ONLY_MESSAGE, requireWritableTenant } from "@/lib/permissions/tenant-access";
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from "@/lib/permissions/taxonomy";
import type { PermissionsMap } from "@/lib/permissions/taxonomy";
import { listRoles } from "./queries";
import { createRole, deleteRole, updateRolePermissions } from "./mutations";
import { createRoleSchema } from "./validation";
import type { RoleFormState, RoleSummary } from "./types";

/** For the Administration role editor. */
export async function getRolesForAdministration(): Promise<RoleSummary[]> {
  if (!(await requirePermission("roles", "view"))) {
    return [];
  }
  return listRoles();
}

export async function createRoleAction(
  _prevState: RoleFormState,
  formData: FormData,
): Promise<RoleFormState> {
  if (!(await requireWritableTenant())) {
    return { error: TENANT_READ_ONLY_MESSAGE };
  }
  if (!(await requirePermission("roles", "create"))) {
    return { error: "You don't have permission to create roles." };
  }

  const companyId = headers().get(TENANT_HEADERS.companyId);
  if (!companyId) {
    return { error: "Could not determine your company." };
  }

  const parsed = createRoleSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const result = await createRole(companyId, parsed.data.name, parsed.data.description);
  if ("error" in result) {
    return { error: result.error };
  }

  revalidatePath("/dashboard/administration");
  return { error: null };
}

/**
 * Toggles one module/action cell in the permission matrix. Guarded by
 * requirePermission — never rely on the UI hiding a checkbox as the only
 * protection. Re-validates every key/value against the known taxonomy
 * rather than trusting whatever shape the client sent.
 */
export async function updateRolePermissionsAction(
  roleId: string,
  permissions: PermissionsMap,
): Promise<{ error: string | null }> {
  if (!(await requireWritableTenant())) {
    return { error: TENANT_READ_ONLY_MESSAGE };
  }
  if (!(await requirePermission("roles", "edit"))) {
    return { error: "You don't have permission to edit roles." };
  }

  const sanitized: PermissionsMap = {};
  for (const moduleKey of PERMISSION_MODULES) {
    // moduleKey is drawn from the fixed PERMISSION_MODULES tuple, not
    // user input — not a dynamic-key injection risk.
    // eslint-disable-next-line security/detect-object-injection
    const actions = permissions[moduleKey];
    if (!actions) continue;
    // eslint-disable-next-line security/detect-object-injection
    sanitized[moduleKey] = actions.filter((action) =>
      (PERMISSION_ACTIONS as readonly string[]).includes(action),
    );
  }

  if (!(await isCurrentUserSuperAdmin())) {
    const caller = await getCurrentUserPermissions();
    for (const moduleKey of PERMISSION_MODULES) {
      const granted = sanitized[moduleKey] ?? [];
      for (const action of granted) {
        if (!hasPermission({ permissions: caller }, moduleKey, action)) {
          return { error: "You can't grant permissions you don't have." };
        }
      }
    }
  }

  const result = await updateRolePermissions(roleId, sanitized);
  if ("error" in result) {
    return { error: result.error };
  }

  revalidatePath("/dashboard/administration");
  return { error: null };
}

export async function deleteRoleAction(roleId: string): Promise<{ error: string | null }> {
  if (!(await requireWritableTenant())) {
    return { error: TENANT_READ_ONLY_MESSAGE };
  }
  if (!(await requirePermission("roles", "delete"))) {
    return { error: "You don't have permission to delete roles." };
  }

  const result = await deleteRole(roleId);
  revalidatePath("/dashboard/administration");
  return result;
}
