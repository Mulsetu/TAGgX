// Shared by the Administration role-editor matrix (rows = actions,
// columns = roles) and every hasPermission() guard call — one list, so
// the UI can never offer a toggle the guard doesn't understand.

export const PERMISSION_MODULES = [
  "assets",
  "categories",
  "locations",
  "statuses",
  "maintenance",
  "users",
  "roles",
  "audits",
  "notifications",
  "settings",
  "vendors",
  "handover",
  "reports",
] as const;
export type PermissionModule = (typeof PERMISSION_MODULES)[number];

export const PERMISSION_ACTIONS = [
  "view",
  "create",
  "edit",
  "delete",
  "assign",
  "export",
  "import",
  "approve",
  "transfer",
  "return",
  "dispose",
  "resolve",
  "configure",
  "manage",
] as const;
export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

/** Stored as roles.permissions jsonb: { [module]: [action, ...] }. */
export type PermissionsMap = Partial<Record<PermissionModule, PermissionAction[]>>;

export const FULL_PERMISSIONS: PermissionsMap = Object.fromEntries(
  PERMISSION_MODULES.map((module) => [module, [...PERMISSION_ACTIONS]]),
) as PermissionsMap;

export const MODULE_LABELS: Record<PermissionModule, string> = {
  assets: "Assets",
  categories: "Categories",
  locations: "Locations",
  statuses: "Statuses",
  maintenance: "Maintenance",
  users: "Users",
  roles: "Roles",
  audits: "Audits",
  notifications: "Notifications",
  settings: "Settings",
  vendors: "Vendors",
  handover: "Handover",
  reports: "Reports",
};

export const ACTION_LABELS: Record<PermissionAction, string> = {
  view: "View",
  create: "Create",
  edit: "Edit",
  delete: "Delete",
  assign: "Assign",
  export: "Export",
  import: "Import",
  approve: "Approve",
  transfer: "Transfer",
  return: "Return",
  dispose: "Dispose",
  resolve: "Resolve",
  configure: "Configure",
  manage: "Manage",
};

/**
 * Existing roles only store the original six actions. New verbs fall back
 * so companies are not locked out until they edit the matrix.
 */
export const ACTION_FALLBACKS: Partial<Record<PermissionAction, PermissionAction[]>> = {
  approve: ["edit"],
  transfer: ["assign"],
  return: ["assign"],
  dispose: ["edit"],
  resolve: ["edit"],
  configure: ["edit"],
  import: ["export", "create"],
  manage: ["configure", "edit"],
};

export const AUDITOR_PERMISSIONS: PermissionsMap = {
  assets: ["view", "export"],
  audits: ["view", "create", "edit", "export", "approve"],
  locations: ["view"],
  categories: ["view"],
  statuses: ["view"],
  reports: ["view", "export"],
  handover: ["view"],
};

export const TECHNICIAN_PERMISSIONS: PermissionsMap = {
  assets: ["view", "edit", "assign"],
  maintenance: ["view", "create", "edit", "assign", "resolve"],
  locations: ["view"],
  statuses: ["view"],
  vendors: ["view"],
};

export const VIEWER_PERMISSIONS: PermissionsMap = {
  assets: ["view"],
  locations: ["view"],
  categories: ["view"],
  statuses: ["view"],
  reports: ["view"],
};

export type Capability = `${PermissionModule}.${PermissionAction}`;

export function parseCapability(capability: Capability): { module: PermissionModule; action: PermissionAction } {
  const [module, action] = capability.split(".") as [PermissionModule, PermissionAction];
  return { module, action };
}
