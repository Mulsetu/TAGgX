import { assertPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions/has-permission";
import { isCurrentUserSuperAdmin } from "@/lib/permissions/super-admin";
import { getRolesForAdministration } from "@/modules/roles/actions";
import { getCompanyUsersForAdmin, getPendingInvitesForAdmin } from "@/modules/users/actions";
import { getVendorOptions } from "@/modules/vendors/actions";
import { InviteUserForm } from "./invite-user-form";
import { UserList } from "./user-list";
import { PendingInviteList } from "./pending-invite-list";

export default async function UsersPage() {
  await assertPermission("users", "view");
  const [users, pendingInvites, roles, vendors, canManageCompanyAdmins] = await Promise.all([
    getCompanyUsersForAdmin(),
    getPendingInvitesForAdmin(),
    getRolesForAdministration(),
    getVendorOptions(),
    Promise.all([isCurrentUserCompanyAdmin(), isCurrentUserSuperAdmin()]).then(
      ([companyAdmin, superAdmin]) => companyAdmin || superAdmin,
    ),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
        <p className="text-sm text-muted-foreground">
          Invite teammates, assign roles, and grant Company Admin access. Company Admins keep full
          product access regardless of role permissions.
        </p>
      </div>

      <InviteUserForm roles={roles} vendors={vendors} />
      <UserList users={users} roles={roles} canManageCompanyAdmins={canManageCompanyAdmins} />

      {pendingInvites.length > 0 ? (
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-medium">Pending invites</h2>
          <PendingInviteList invites={pendingInvites} />
        </div>
      ) : null}
    </div>
  );
}
