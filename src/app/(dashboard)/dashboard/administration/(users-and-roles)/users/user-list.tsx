"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { setCompanyAdminAction, toggleUserActiveAction, updateUserRoleAction } from "@/modules/users/actions";
import type { CompanyUserSummary } from "@/modules/users/types";
import type { RoleSummary } from "@/modules/roles/types";

function initials(user: CompanyUserSummary): string {
  const source = (user.fullName ?? user.email).trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

function formatAdded(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function UserCard({
  user,
  roles,
  canManageCompanyAdmins,
  isYou,
}: {
  user: CompanyUserSummary;
  roles: RoleSummary[];
  canManageCompanyAdmins: boolean;
  isYou: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isRolePending, startRole] = useTransition();
  const [isActivePending, startActive] = useTransition();
  const [isAdminPending, startAdmin] = useTransition();
  const added = formatAdded(user.createdAt);

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

  function handleGrantAdmin() {
    setError(null);
    startAdmin(async () => {
      const result = await setCompanyAdminAction(user.id, true);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--brand-primary))] text-xs font-semibold text-[hsl(var(--sidebar-foreground))]">
          {initials(user)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-slate-900">
              {user.fullName ?? user.email}
              {isYou ? <span className="font-normal text-slate-500"> (you)</span> : null}
            </p>
            {user.isCompanyAdmin ? <Badge>Company admin</Badge> : null}
            {user.isActive ? null : <Badge variant="outline">Deactivated</Badge>}
          </div>
          <p className="truncate text-sm text-slate-500">{user.email}</p>
          {added ? <p className="text-xs text-slate-400">Added {added}</p> : null}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
        {user.isCompanyAdmin ? (
          // Fixed for everyone, including other Company Admins (migration 0052).
          <p className="flex items-center gap-1.5 text-sm text-slate-600">
            <Lock className="size-3.5" />
            Company Admin · role can&apos;t be changed
          </p>
        ) : (
          <NativeSelect
            className="w-auto min-w-40"
            value={user.roleId}
            disabled={isRolePending}
            aria-label={`Role for ${user.fullName ?? user.email}`}
            onChange={(event) => handleRoleChange(event.target.value)}
          >
            {roles
              .filter((role) => !(role.isSystem && role.name === "Company Admin"))
              .map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
          </NativeSelect>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {user.isCompanyAdmin && user.isActive ? null : (
            <Button type="button" variant="outline" size="sm" disabled={isActivePending} onClick={handleToggleActive}>
              {isActivePending ? "Saving..." : user.isActive ? "Deactivate" : "Reactivate"}
            </Button>
          )}
          {canManageCompanyAdmins && !user.isCompanyAdmin ? (
            <Button type="button" variant="outline" size="sm" disabled={isAdminPending} onClick={handleGrantAdmin}>
              {isAdminPending ? "Saving..." : "Make company admin"}
            </Button>
          ) : null}
        </div>
      </div>
      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
    </article>
  );
}

export function UserList({
  users,
  roles,
  canManageCompanyAdmins,
  currentUserId,
}: {
  users: CompanyUserSummary[];
  roles: RoleSummary[];
  canManageCompanyAdmins: boolean;
  currentUserId: string | null;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return users;
    }
    return users.filter((user) => {
      const name = user.fullName?.toLowerCase() ?? "";
      return name.includes(needle) || user.email.toLowerCase().includes(needle);
    });
  }, [query, users]);

  return (
    <div className="flex flex-col gap-3">
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search by name or email"
        className="max-w-sm bg-white"
        aria-label="Search people"
      />
      {users.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
          No people yet. Invite someone to get started.
        </p>
      ) : filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
          No people match that search.
        </p>
      ) : (
        <div className="flex max-w-3xl flex-col gap-3">
          {filtered.map((user) => (
            <UserCard
              key={user.id}
              user={user}
              roles={roles}
              canManageCompanyAdmins={canManageCompanyAdmins}
              isYou={user.id === currentUserId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
