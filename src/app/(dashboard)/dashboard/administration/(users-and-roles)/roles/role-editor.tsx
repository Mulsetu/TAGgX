"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Shield } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ACTION_LABELS,
  MODULE_LABELS,
  PERMISSION_ACTIONS,
  PERMISSION_MODULES,
} from "@/lib/permissions/taxonomy";
import type { PermissionAction, PermissionModule, PermissionsMap } from "@/lib/permissions/taxonomy";
import { deleteRoleAction, duplicateRoleAction, updateRolePermissionsAction } from "@/modules/roles/actions";
import type { RoleSummary } from "@/modules/roles/types";
import { cn } from "@/lib/utils";

const MODULE_HINTS: Record<PermissionModule, string> = {
  assets: "View and manage the asset register.",
  categories: "Organize assets into categories.",
  locations: "Sites, buildings, floors, and rooms.",
  statuses: "Asset status labels.",
  maintenance: "Tickets and maintenance plans.",
  users: "Invite people and assign roles.",
  roles: "Create roles and set what they can open.",
  audits: "Plan and record floor audits.",
  notifications: "Alerts sent to this workspace.",
  settings: "Company profile, branding, and billing.",
  vendors: "Vendors linked to assets.",
  handover: "Hand an asset to someone else.",
  reports: "Exports and summaries.",
};

function clonePermissions(roles: RoleSummary[]): Record<string, PermissionsMap> {
  return Object.fromEntries(roles.map((role) => [role.id, { ...role.permissions }]));
}

function samePermissions(left: PermissionsMap, right: PermissionsMap): boolean {
  return PERMISSION_MODULES.every((module) => {
    // module is from the fixed taxonomy, not user input.
    // eslint-disable-next-line security/detect-object-injection
    const a = [...(left[module] ?? [])].sort().join(",");
    // eslint-disable-next-line security/detect-object-injection
    const b = [...(right[module] ?? [])].sort().join(",");
    return a === b;
  });
}

function moduleEnabled(permissions: PermissionsMap, module: PermissionModule): boolean {
  // eslint-disable-next-line security/detect-object-injection
  return (permissions[module]?.length ?? 0) > 0;
}

export function RoleEditor({
  roles: initialRoles,
  userCounts,
}: {
  roles: RoleSummary[];
  userCounts: Record<string, number> | null;
}) {
  const router = useRouter();
  const [roles, setRoles] = useState(initialRoles);
  const [drafts, setDrafts] = useState(() => clonePermissions(initialRoles));
  const [selectedId, setSelectedId] = useState(initialRoles[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isDeleting, startDelete] = useTransition();
  const [duplicating, setDuplicating] = useState(false);

  useEffect(() => {
    setRoles(initialRoles);
    setDrafts(clonePermissions(initialRoles));
    setSelectedId((current) =>
      current && initialRoles.some((role) => role.id === current) ? current : (initialRoles[0]?.id ?? ""),
    );
  }, [initialRoles]);

  const selected = roles.find((role) => role.id === selectedId) ?? null;
  const draft = selected ? (drafts[selected.id] ?? selected.permissions) : {};
  const dirty = selected ? !samePermissions(draft, selected.permissions) : false;
  const locked = Boolean(selected?.isSystem);

  function updateDraft(next: PermissionsMap) {
    if (!selected || locked) {
      return;
    }
    setDrafts((prev) => ({ ...prev, [selected.id]: next }));
  }

  function setModule(module: PermissionModule, enabled: boolean) {
    if (!selected) {
      return;
    }
    const next: PermissionsMap = { ...draft };
    if (!enabled) {
      next[module] = [];
    } else if (!moduleEnabled(draft, module)) {
      next[module] = ["view"];
    }
    updateDraft(next);
  }

  function toggleAction(module: PermissionModule, action: PermissionAction) {
    // eslint-disable-next-line security/detect-object-injection
    const current = draft[module] ?? [];
    const nextActions = current.includes(action)
      ? current.filter((item) => item !== action)
      : [...current, action];
    updateDraft({ ...draft, [module]: nextActions });
  }

  async function save() {
    if (!selected || locked || !dirty) {
      return;
    }
    setSaving(true);
    setError(null);
    const result = await updateRolePermissionsAction(selected.id, draft);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setRoles((prev) => prev.map((role) => (role.id === selected.id ? { ...role, permissions: draft } : role)));
    router.refresh();
  }

  function handleDelete(role: RoleSummary) {
    setError(null);
    startDelete(async () => {
      const result = await deleteRoleAction(role.id);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function handleDuplicate(role: RoleSummary) {
    setError(null);
    setDuplicating(true);
    startDelete(async () => {
      const result = await duplicateRoleAction(role.id);
      setDuplicating(false);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  if (roles.length === 0) {
    return <p className="text-sm text-slate-500">No roles yet. Create one to get started.</p>;
  }

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
      <div className="flex flex-col gap-2">
        {roles.map((role) => {
          const count = userCounts ? (userCounts[role.id] ?? 0) : null;
          const active = role.id === selectedId;
          return (
            <button
              key={role.id}
              type="button"
              onClick={() => setSelectedId(role.id)}
              className={cn(
                "rounded-xl border bg-white px-4 py-3 text-left transition-colors",
                active
                  ? "border-[hsl(var(--brand-primary))] ring-1 ring-[hsl(var(--brand-primary))]"
                  : "border-slate-200 hover:border-slate-300",
              )}
            >
              <p className="font-medium text-slate-900">{role.name}</p>
              <p className="text-xs text-slate-500">
                {count === null ? null : (
                  <>
                    {count} {count === 1 ? "user" : "users"}
                    {role.isSystem ? " · " : ""}
                  </>
                )}
                {role.isSystem ? "Built-in" : null}
              </p>
            </button>
          );
        })}
      </div>

      {selected ? (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[hsl(var(--brand-primary))] text-[hsl(var(--sidebar-foreground))]">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{selected.name}</h2>
                <p className="text-xs text-slate-500">
                  {userCounts
                    ? `${userCounts[selected.id] ?? 0} ${(userCounts[selected.id] ?? 0) === 1 ? "user" : "users"} on this role`
                    : selected.isSystem
                      ? "Built-in role"
                      : "Custom role"}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={duplicating || isDeleting}
                onClick={() => handleDuplicate(selected)}
              >
                {duplicating ? "Copying..." : "Duplicate"}
              </Button>
              {locked ? null : (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button type="button" variant="outline" size="sm">
                      Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete the {selected.name} role?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This can&apos;t be undone. A role stays until nobody is assigned to it.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={(event) => {
                          event.preventDefault();
                          handleDelete(selected);
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
          </div>

          <div className="flex flex-col gap-5 px-5 py-4">
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="selected-role-name">Role name</Label>
              <Input id="selected-role-name" value={selected.name} readOnly />
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Module access</p>
              <p className="mb-3 mt-1 text-sm text-slate-500">
                People with this role only see the ticked sections. Tick a section, then choose the actions inside it.
              </p>
              <div className="flex flex-col gap-4">
                {PERMISSION_MODULES.map((module) => {
                  const enabled = moduleEnabled(draft, module);
                  return (
                    <div key={module}>
                      <label className="flex items-start gap-3">
                        <Checkbox
                          className="mt-0.5"
                          checked={enabled}
                          disabled={locked}
                          onCheckedChange={(checked) => setModule(module, checked === true)}
                          aria-label={MODULE_LABELS[module]}
                        />
                        <span>
                          <span className="block text-sm font-medium text-slate-900">{MODULE_LABELS[module]}</span>
                          <span className="block text-xs text-slate-500">{MODULE_HINTS[module]}</span>
                        </span>
                      </label>
                      {enabled ? (
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 pl-7">
                          {PERMISSION_ACTIONS.map((action) => (
                            <label key={action} className="flex items-center gap-1.5 text-xs text-slate-600">
                              <Checkbox
                                checked={draft[module]?.includes(action) ?? false}
                                disabled={locked}
                                onCheckedChange={() => toggleAction(module, action)}
                                aria-label={`${MODULE_LABELS[module]} ${ACTION_LABELS[action]}`}
                              />
                              {ACTION_LABELS[action]}
                            </label>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex justify-end border-t border-slate-100 bg-slate-50 px-5 py-3">
            <Button type="button" disabled={locked || !dirty || saving} onClick={save}>
              {saving ? "Saving..." : "Save changes"}
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
