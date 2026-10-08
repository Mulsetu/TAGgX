import { assertPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions/has-permission";
import { isCurrentUserSuperAdmin } from "@/lib/permissions/super-admin";
import { getRolesForAdministration } from "@/modules/roles/actions";
import { getCompanyUsersForAdmin, getCurrentUser, getPendingInvitesForAdmin } from "@/modules/users/actions";
import { getVendorOptions } from "@/modules/vendors/actions";
import { InviteUserForm } from "./invite-user-form";
import { UserList } from "./user-list";
import { PendingInviteList } from "./pending-invite-list";

export default async function UsersPage() {
  await assertPermission("users", "view");
  const [users, pendingInvites, roles, vendors, canManageCompanyAdmins, currentUser] = await Promise.all([
    getCompanyUsersForAdmin(),
    getPendingInvitesForAdmin(),
    getRolesForAdministration(),
    getVendorOptions(),
    Promise.all([isCurrentUserCompanyAdmin(), isCurrentUserSuperAdmin()]).then(
      ([companyAdmin, superAdmin]) => companyAdmin || superAdmin,
    ),
    getCurrentUser(),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-slate-500">
        People in this workspace. The company admin stays active and keeps full access.
      </p>

      <InviteUserForm roles={roles} vendors={vendors} />
      <UserList
        users={users}
        roles={roles}
        canManageCompanyAdmins={canManageCompanyAdmins}
        currentUserId={currentUser?.id ?? null}
      />

      {pendingInvites.length > 0 ? (
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-medium">Pending invites</h2>
          <PendingInviteList invites={pendingInvites} />
        </div>
      ) : null}
    </div>
  );
}
