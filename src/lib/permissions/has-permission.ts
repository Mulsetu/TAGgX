import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TENANT_HEADERS } from "@/lib/tenant";
import { isCurrentUserSuperAdmin } from "./super-admin";
import { ACTION_FALLBACKS, type PermissionAction, type PermissionModule, type PermissionsMap } from "./taxonomy";

export interface PermissionUser {
  permissions: PermissionsMap;
}

/** Pure check against data already in hand — no DB, no session. */
export function hasPermission(user: PermissionUser, module: PermissionModule, action: PermissionAction): boolean {
  // module is typed as the PermissionModule union, not an arbitrary
  // string — not a dynamic/user-controlled key.
  // eslint-disable-next-line security/detect-object-injection
  const granted = user.permissions[module] ?? [];
  if (granted.includes(action)) {
    return true;
  }
  const fallbacks = ACTION_FALLBACKS[action] ?? [];
  return fallbacks.some((fallback) => granted.includes(fallback));
}

interface RolePermissionsRow {
  permissions: PermissionsMap;
}

/**
 * Loads the current session's role permissions. role_id comes from the
 * x-role-id header middleware.ts sets after verifying the session against
 * the DB — never trusted from a client-supplied value.
 */
export async function getCurrentUserPermissions(): Promise<PermissionsMap> {
  const roleId = headers().get(TENANT_HEADERS.roleId);
  if (!roleId) {
    return {};
  }

  const supabase = createClient();
  const { data } = await supabase
    .from("roles")
    .select("permissions")
    .eq("id", roleId)
    .maybeSingle<RolePermissionsRow>();

  return data?.permissions ?? {};
}

/**
 * The guard every mutating server action should call first — never rely
 * on the UI hiding a button as the only protection. Super admins bypass
 * every module/action check, consistent with the RLS *_super_admin_bypass
 * policies already granting them full DB access regardless of company.
 */
export async function requirePermission(module: PermissionModule, action: PermissionAction): Promise<boolean> {
  if (await isCurrentUserSuperAdmin()) {
    return true;
  }

  const permissions = await getCurrentUserPermissions();
  return hasPermission({ permissions }, module, action);
}

/** Pages: deny direct URLs instead of rendering an empty privileged screen. */
export async function assertPermission(module: PermissionModule, action: PermissionAction): Promise<void> {
  if (!(await requirePermission(module, action))) {
    redirect("/dashboard");
  }
}
