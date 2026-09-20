"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { setCompanyAdminAction, toggleUserActiveAction, updateUserRoleAction } from "@/modules/users/actions";
import type { CompanyUserSummary } from "@/modules/users/types";
import type { RoleSummary } from "@/modules/roles/types";

function UserRow({
  user,
  roles,
  canManageCompanyAdmins,
}: {
  user: CompanyUserSummary;
  roles: RoleSummary[];
  canManageCompanyAdmins: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isRolePending, startRole] = useTransition();
  const [isActivePending, startActive] = useTransition();
  const [isAdminPending, startAdmin] = useTransition();

  function handleRoleChange(roleId: string) {
    setError(null);
    startRole(async () => {
      const result = await updateUserRoleAction(user.id, roleId);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function handleToggleActive() {
    setError(null);
    startActive(async () => {
      const result = await toggleUserActiveAction(user.id, !user.isActive);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function handleToggleCompanyAdmin() {
    setError(null);
    startAdmin(async () => {
      const result = await setCompanyAdminAction(user.id, !user.isCompanyAdmin);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <TableRow>
      <TableCell className="font-medium">{user.fullName ?? "—"}</TableCell>
      <TableCell className="text-muted-foreground">{user.email}</TableCell>
      <TableCell>
        <NativeSelect
          className="w-auto"
          value={user.roleId}
          disabled={isRolePending}
          onChange={(e) => handleRoleChange(e.target.value)}
        >
          {roles.map((role) => (
            <option key={role.id} value={role.id}>
              {role.name}
            </option>
          ))}
        </NativeSelect>
      </TableCell>
      <TableCell>
        {user.isCompanyAdmin ? <Badge>Company Admin</Badge> : null}{" "}
        {user.isActive ? <Badge variant="secondary">Active</Badge> : <Badge variant="outline">Deactivated</Badge>}
      </TableCell>
      <TableCell className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" disabled={isActivePending} onClick={handleToggleActive}>
          {isActivePending ? "Saving..." : user.isActive ? "Deactivate" : "Reactivate"}
        </Button>
        {canManageCompanyAdmins ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isAdminPending}
            onClick={handleToggleCompanyAdmin}
          >
            {isAdminPending ? "Saving..." : user.isCompanyAdmin ? "Revoke admin" : "Make Company Admin"}
          </Button>
        ) : null}
        {error ? <p className="mt-1 w-full text-xs text-destructive">{error}</p> : null}
      </TableCell>
    </TableRow>
  );
}

export function UserList({
  users,
  roles,
  canManageCompanyAdmins,
}: {
  users: CompanyUserSummary[];
  roles: RoleSummary[];
  canManageCompanyAdmins: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                No members yet.
              </TableCell>
            </TableRow>
          ) : (
            users.map((user) => (
              <UserRow
                key={user.id}
                user={user}
                roles={roles}
                canManageCompanyAdmins={canManageCompanyAdmins}
              />
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
