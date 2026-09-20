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
] as const;
export type PermissionModule = (typeof PERMISSION_MODULES)[number];

export const PERMISSION_ACTIONS = ["view", "create", "edit", "delete"] as const;
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
};

export const ACTION_LABELS: Record<PermissionAction, string> = {
  view: "View",
  create: "Create",
  edit: "Edit",
  delete: "Delete",
};
