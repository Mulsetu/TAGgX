"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ACTION_LABELS,
  MODULE_LABELS,
  PERMISSION_ACTIONS,
  PERMISSION_MODULES,
} from "@/lib/permissions/taxonomy";
import type { PermissionAction, PermissionModule, PermissionsMap } from "@/lib/permissions/taxonomy";
import { deleteRoleAction, updateRolePermissionsAction } from "@/modules/roles/actions";
import type { RoleSummary } from "@/modules/roles/types";

interface RoleEditorProps {
  roles: RoleSummary[];
}

// One row per (module, action) pair — "rows = actions, columns = roles",
// with the module folded into the row label so a single table covers
// every permission instead of one table per module.
const ROWS: { module: PermissionModule; action: PermissionAction }[] = PERMISSION_MODULES.flatMap(
  (module) => PERMISSION_ACTIONS.map((action) => ({ module, action })),
);

function cellKey(roleId: string, module: PermissionModule, action: PermissionAction) {
  return `${roleId}:${module}:${action}`;
}

function rowLabel(module: PermissionModule, action: PermissionAction): string {
  // eslint-disable-next-line security/detect-object-injection
  return `${MODULE_LABELS[module]} — ${ACTION_LABELS[action]}`;
}

export function RoleEditor({ roles: initialRoles }: RoleEditorProps) {
  const router = useRouter();
  const [roles, setRoles] = useState(initialRoles);
  const [pendingCells, setPendingCells] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, startDelete] = useTransition();

  // module/action below are always drawn from the fixed PermissionModule /
  // PermissionAction unions (via ROWS, PERMISSION_MODULES, etc.), never
  // arbitrary strings — not a dynamic-key injection risk anywhere in this
  // file.
  function isChecked(role: RoleSummary, module: PermissionModule, action: PermissionAction) {
    // eslint-disable-next-line security/detect-object-injection
    return role.permissions[module]?.includes(action) ?? false;
  }

  async function toggle(role: RoleSummary, module: PermissionModule, action: PermissionAction) {
    // The seeded "Admin" role always keeps full access — never editable —
    // so a company can never accidentally lock itself out of its own
    // workspace. Enforced here (button disabled) and, more importantly,
    // server-side in updateRolePermissionsAction.
    if (role.isSystem) return;

    const key = cellKey(role.id, module, action);
    if (pendingCells.has(key)) return; // already in flight — ignore extra clicks

    const currentlyChecked = isChecked(role, module, action);
    // eslint-disable-next-line security/detect-object-injection
    const currentActions = role.permissions[module] ?? [];
    const nextActions = currentlyChecked
      ? currentActions.filter((a) => a !== action)
      : [...currentActions, action];
    const nextPermissions: PermissionsMap = { ...role.permissions, [module]: nextActions };

    setPendingCells((prev) => new Set(prev).add(key));
    setError(null);
    // Optimistic update so toggling feels instant.
    setRoles((prev) => prev.map((r) => (r.id === role.id ? { ...r, permissions: nextPermissions } : r)));

    const result = await updateRolePermissionsAction(role.id, nextPermissions);

    setPendingCells((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });

    if (result.error) {
      setError(result.error);
      // Revert on failure.
      setRoles((prev) => prev.map((r) => (r.id === role.id ? role : r)));
    }
  }

  function handleDelete(role: RoleSummary) {
    setDeleteError(null);
    startDelete(async () => {
      const result = await deleteRoleAction(role.id);
      if (result.error) {
        setDeleteError(result.error);
        return;
      }
      setRoles((prev) => prev.filter((r) => r.id !== role.id));
      router.refresh();
    });
  }

  if (roles.length === 0) {
    return <p className="text-sm text-muted-foreground">No roles yet — create one to get started.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {deleteError ? (
        <p role="alert" className="text-sm text-destructive">
          {deleteError}
        </p>
      ) : null}
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Permission</TableHead>
              {roles.map((role) => (
                <TableHead key={role.id} className="text-center">
                  <div className="flex flex-col items-center gap-1">
                    <span className="flex items-center gap-1.5">
                      {role.name}
                      {role.isSystem ? <Badge variant="secondary">Default</Badge> : null}
                    </span>
                    {role.isSystem ? (
                      <span className="text-xs font-normal text-muted-foreground">Read-only</span>
                    ) : (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs">
                            Delete
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete the {role.name} role?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This can&apos;t be undone. You can&apos;t delete a role while any user is
                              still assigned to it.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={(e) => {
                                e.preventDefault();
                                handleDelete(role);
                              }}
                              disabled={isDeleting}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              {isDeleting ? "Deleting..." : "Delete"}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {ROWS.map(({ module, action }) => (
              <TableRow key={`${module}-${action}`}>
                <TableCell className="text-sm text-muted-foreground">{rowLabel(module, action)}</TableCell>
                {roles.map((role) => {
                  const key = cellKey(role.id, module, action);
                  return (
                    <TableCell key={role.id} className="text-center">
                      <Checkbox
                        checked={isChecked(role, module, action)}
                        disabled={role.isSystem || pendingCells.has(key)}
                        onCheckedChange={() => toggle(role, module, action)}
                        aria-label={`${role.name}: ${rowLabel(module, action)}`}
                      />
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
