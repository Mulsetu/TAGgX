import "server-only";
import { requirePermission } from "./has-permission";
import { getEnabledModules } from "./features";
import type { FeatureModule } from "./features";
import type { PermissionModule } from "./taxonomy";

export interface AdminSection {
  title: string;
  href: string;
  module: PermissionModule;
  feature?: FeatureModule;
}

export const ADMIN_SECTIONS: AdminSection[] = [
  { title: "Users", href: "/dashboard/administration/users", module: "users" },
  { title: "Roles", href: "/dashboard/administration/roles", module: "roles" },
  { title: "Categories", href: "/dashboard/administration/categories", module: "categories" },
  { title: "Asset fields", href: "/dashboard/administration/fields", module: "categories", feature: "custom_fields" },
  { title: "Locations", href: "/dashboard/administration/locations", module: "locations" },
  { title: "Statuses", href: "/dashboard/administration/statuses", module: "statuses" },
  { title: "Conditions", href: "/dashboard/administration/conditions", module: "statuses" },
  { title: "Maintenance", href: "/dashboard/administration/maintenance", module: "maintenance", feature: "maintenance" },
  { title: "Preventive maintenance", href: "/dashboard/administration/maintenance/plans", module: "maintenance", feature: "preventive_maintenance" },
  { title: "Vendors", href: "/dashboard/administration/vendors", module: "vendors", feature: "vendors" },
  { title: "Audits", href: "/dashboard/administration/audits", module: "audits", feature: "audits" },
  { title: "Reports", href: "/dashboard/administration/reports", module: "reports", feature: "reports" },
  { title: "Notifications", href: "/dashboard/administration/notifications", module: "notifications", feature: "email" },
  { title: "Activity", href: "/dashboard/administration/activity", module: "settings" },
  { title: "Modules", href: "/dashboard/administration/settings#modules", module: "settings" },
  { title: "Dashboard", href: "/dashboard/administration/settings#dashboard", module: "settings" },
  { title: "Settings", href: "/dashboard/administration/settings", module: "settings" },
];

const CATALOG_MODULES: PermissionModule[] = ["categories", "locations", "statuses"];

export async function getVisibleAdminSections(): Promise<AdminSection[]> {
  const enabled = await getEnabledModules();
  const visible = await Promise.all(
    ADMIN_SECTIONS.map(async (section) => {
      if (section.feature && !enabled[section.feature]) {
        return null;
      }
      return (await requirePermission(section.module, "view")) ? section : null;
    }),
  );
  return visible.filter((section): section is AdminSection => section !== null);
}

export interface SidebarAdminNav {
  assets: boolean;
  maintenance: AdminSection | null;
  audits: AdminSection | null;
  settings: AdminSection | null;
  vendors: AdminSection | null;
  reports: AdminSection | null;
  catalogSections: AdminSection[];
}

export async function getSidebarAdminNav(): Promise<SidebarAdminNav> {
  const [visible, enabled, canViewAssets] = await Promise.all([
    getVisibleAdminSections(),
    getEnabledModules(),
    requirePermission("assets", "view"),
  ]);
  const byHref = new Map(visible.map((section) => [section.href, section]));
  const usersAndRoles = visible.find((section) => section.module === "users" || section.module === "roles");
  const settingsExtras = visible.filter(
    (section) =>
      section.href === "/dashboard/administration/settings#modules" ||
      section.href === "/dashboard/administration/settings#dashboard",
  );

  return {
    assets: enabled.assets && canViewAssets,
    maintenance: byHref.get("/dashboard/administration/maintenance") ?? null,
    audits: byHref.get("/dashboard/administration/audits") ?? null,
    settings: byHref.get("/dashboard/administration/settings") ?? null,
    vendors: byHref.get("/dashboard/administration/vendors") ?? null,
    reports: byHref.get("/dashboard/administration/reports") ?? null,
    catalogSections: [
      ...(usersAndRoles ? [{ title: "Users & Roles", href: usersAndRoles.href, module: usersAndRoles.module }] : []),
      ...visible.filter((section) => CATALOG_MODULES.includes(section.module) && section.href !== usersAndRoles?.href),
      ...settingsExtras,
    ],
  };
}
