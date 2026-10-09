import { assertPermission, requirePermission } from "@/lib/permissions/has-permission";
import { getRolesForAdministration } from "@/modules/roles/actions";
import { getCompanyUsersForAdmin } from "@/modules/users/actions";
import { CreateRoleForm } from "./create-role-form";
import { RoleEditor } from "./role-editor";

export default async function RolesPage() {
  await assertPermission("roles", "view");
  const [canCountUsers, canDelete] = await Promise.all([
    requirePermission("users", "view"),
    requirePermission("roles", "delete"),
  ]);
  const [roles, users] = await Promise.all([
    getRolesForAdministration(),
    canCountUsers ? getCompanyUsersForAdmin() : Promise.resolve([]),
  ]);
  const userCounts = canCountUsers
    ? Object.fromEntries(roles.map((role) => [role.id, users.filter((user) => user.roleId === role.id).length]))
    : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <p className="max-w-xl text-sm text-slate-500">
          Pick a role and tick the sections it can open. Company admin always has full access.
        </p>
        <CreateRoleForm />
      </div>
      <RoleEditor roles={roles} userCounts={userCounts} canDelete={canDelete} />
    </div>
  );
}
