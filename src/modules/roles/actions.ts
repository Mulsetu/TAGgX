"use server";

import "server-only";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { TENANT_HEADERS } from "@/lib/tenant";
import { clientIpFromHeaders, consumeRateLimit } from "@/lib/rate-limit";
import { isCurrentUserCompanyAdmin, requirePermission, getCurrentUserPermissions, hasPermission } from "@/lib/permissions/has-permission";
import { isCurrentUserSuperAdmin } from "@/lib/permissions/super-admin";
import { TENANT_READ_ONLY_MESSAGE, requireWritableTenant } from "@/lib/permissions/tenant-access";
import { writeAuditLog } from "@/lib/audit-log";
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from "@/lib/permissions/taxonomy";
import type { PermissionsMap } from "@/lib/permissions/taxonomy";
import { listRoles } from "./queries";
import { createRole, deleteRole, duplicateRole, updateRolePermissions } from "./mutations";
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

  const roleCreateKey = `role-create:${companyId}:${clientIpFromHeaders(headers())}`;
  if (!consumeRateLimit(roleCreateKey, 30, 60 * 60 * 1000)) {
    return { error: "Too many roles created. Try again later." };
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

  await writeAuditLog({
    action: "role.created",
    entityType: "role",
    entityId: result.id,
    newValues: { name: parsed.data.name },
  });

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

  if (!(await isCurrentUserSuperAdmin()) && !(await isCurrentUserCompanyAdmin())) {
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

  await writeAuditLog({
    action: "role.permissions_changed",
    entityType: "role",
    entityId: roleId,
    newValues: { permissions: sanitized },
  });

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

export async function duplicateRoleAction(roleId: string): Promise<{ error: string | null }> {
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

  const roles = await listRoles();
  const source = roles.find((role) => role.id === roleId);
  if (!source) {
    return { error: "Role not found." };
  }

  const base = `${source.name} copy`.slice(0, 90);
  let name = base;
  let suffix = 2;
  const names = new Set(roles.map((role) => role.name.toLowerCase()));
  while (names.has(name.toLowerCase())) {
    name = `${base} ${suffix}`;
    suffix += 1;
  }

  const result = await duplicateRole(companyId, roleId, name);
  if ("error" in result) {
    return { error: result.error };
  }

  revalidatePath("/dashboard/administration");
  return { error: null };
}
