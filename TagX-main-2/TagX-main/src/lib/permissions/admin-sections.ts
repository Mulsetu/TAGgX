import "server-only";
import { requirePermission } from "./has-permission";
import type { PermissionModule } from "./taxonomy";

export interface AdminSection {
  title: string;
  href: string;
  module: PermissionModule;
}

/**
 * Every page under /dashboard/administration, with the permission module
 * that gates it. Single source of truth — consumed both to build the
 * sidebar (getSidebarAdminNav below) and to pick a fallback redirect
 * target for the bare /administration index.
 */
export const ADMIN_SECTIONS: AdminSection[] = [
  { title: "Users", href: "/dashboard/administration/users", module: "users" },
  { title: "Roles", href: "/dashboard/administration/roles", module: "roles" },
  { title: "Categories", href: "/dashboard/administration/categories", module: "categories" },
  { title: "Asset fields", href: "/dashboard/administration/fields", module: "categories" },
  { title: "Locations", href: "/dashboard/administration/locations", module: "locations" },
  { title: "Statuses", href: "/dashboard/administration/statuses", module: "statuses" },
  { title: "Maintenance", href: "/dashboard/administration/maintenance", module: "maintenance" },
  { title: "Audits", href: "/dashboard/administration/audits", module: "audits" },
  { title: "Settings", href: "/dashboard/administration/settings", module: "settings" },
];

const CATALOG_MODULES: PermissionModule[] = ["categories", "locations", "statuses"];

/** Admin sections the signed-in caller has "view" permission for. */
export async function getVisibleAdminSections(): Promise<AdminSection[]> {
  const visible = await Promise.all(
    ADMIN_SECTIONS.map(async (section) => ((await requirePermission(section.module, "view")) ? section : null)),
  );
  return visible.filter((section): section is AdminSection => section !== null);
}

export interface SidebarAdminNav {
  maintenance: AdminSection | null;
  audits: AdminSection | null;
  settings: AdminSection | null;
  /** Nested under the Administration sidebar group. */
  catalogSections: AdminSection[];
}

/** Shapes getVisibleAdminSections() into the groups AppSidebar renders. */
export async function getSidebarAdminNav(): Promise<SidebarAdminNav> {
  const visible = await getVisibleAdminSections();
  const byModule = new Map(visible.map((section) => [section.module, section]));
  const usersAndRoles = byModule.get("users") ?? byModule.get("roles");

  return {
    maintenance: byModule.get("maintenance") ?? null,
    audits: byModule.get("audits") ?? null,
    settings: byModule.get("settings") ?? null,
    catalogSections: [
      ...(usersAndRoles ? [{ title: "Users & Roles", href: usersAndRoles.href, module: usersAndRoles.module }] : []),
      ...visible.filter((section) => CATALOG_MODULES.includes(section.module)),
    ],
  };
}
