import { assertPermission } from "@/lib/permissions/has-permission";
import { getRolesForAdministration } from "@/modules/roles/actions";
import { CreateRoleForm } from "./create-role-form";
import { RoleEditor } from "./role-editor";

export default async function RolesPage() {
  await assertPermission("roles", "view");
  const roles = await getRolesForAdministration();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Rules &amp; Permissions</h1>
        <p className="text-sm text-muted-foreground">
          Create custom roles and control exactly what each one can do. Company Admin access is
          independent of this matrix — changing role permissions cannot lock a Company Admin out
          of the workspace.
        </p>
      </div>

      <CreateRoleForm />
      <RoleEditor roles={roles} />
    </div>
  );
}
