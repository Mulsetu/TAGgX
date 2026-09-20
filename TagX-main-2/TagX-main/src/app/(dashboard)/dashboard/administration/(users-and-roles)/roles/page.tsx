import { getRolesForAdministration } from "@/modules/roles/actions";
import { CreateRoleForm } from "./create-role-form";
import { RoleEditor } from "./role-editor";

export default async function RolesPage() {
  const roles = await getRolesForAdministration();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Rules &amp; Permissions</h1>
        <p className="text-sm text-muted-foreground">
          Create roles and control exactly what each one can do. The default Admin role is
          read-only — it always has full access so the company can never lock itself out.
        </p>
      </div>

      <CreateRoleForm />
      <RoleEditor roles={roles} />
    </div>
  );
}
