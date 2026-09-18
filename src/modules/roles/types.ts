import type { PermissionsMap } from "@/lib/permissions/taxonomy";

export interface RoleSummary {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: PermissionsMap;
}

export interface RoleFormState {
  error: string | null;
}
