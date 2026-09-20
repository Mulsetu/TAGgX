import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TENANT_HEADERS } from "@/lib/tenant";
import { isCurrentUserSuperAdmin } from "./super-admin";
import {
  ACTION_FALLBACKS,
  parseCapability,
  type Capability,
  type PermissionAction,
  type PermissionModule,
  type PermissionsMap,
} from "./taxonomy";

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
 * Company Admin is a user flag, not a role-matrix row. Middleware stamps
 * x-is-company-admin after reading public.users — never from the client.
 */
export function isCompanyAdminFromHeaders(): boolean {
  return headers().get(TENANT_HEADERS.isCompanyAdmin) === "true";
}

export async function isCurrentUserCompanyAdmin(): Promise<boolean> {
  if (isCompanyAdminFromHeaders()) {
    return true;
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return false;
  }

  const { data } = await supabase
    .from("users")
    .select("is_company_admin")
    .eq("id", user.id)
    .maybeSingle<{ is_company_admin: boolean }>();

  return data?.is_company_admin === true;
}

/**
 * The guard every mutating server action should call first — never rely
 * on the UI hiding a button as the only protection.
 *
 * Platform super-admins bypass the role matrix (RLS super-admin policies).
 * Company Admins bypass the role matrix inside their own company, but
 * still go through plan + company module checks via requireModule().
 */
export async function requirePermission(module: PermissionModule, action: PermissionAction): Promise<boolean> {
  if (await isCurrentUserSuperAdmin()) {
    return true;
  }

  if (await isCurrentUserCompanyAdmin()) {
    return true;
  }

  const permissions = await getCurrentUserPermissions();
  return hasPermission({ permissions }, module, action);
}

/** `can("assets.view")` — same engine as requirePermission. */
export async function can(capability: Capability): Promise<boolean> {
  const { module, action } = parseCapability(capability);
  return requirePermission(module, action);
}

/** Pages: deny direct URLs instead of rendering an empty privileged screen. */
export async function assertPermission(module: PermissionModule, action: PermissionAction): Promise<void> {
  if (!(await requirePermission(module, action))) {
    redirect("/dashboard");
  }
}

export async function assertCan(capability: Capability): Promise<void> {
  if (!(await can(capability))) {
    redirect("/dashboard");
  }
}
