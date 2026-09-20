"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { FEATURE_MODULE_DESCRIPTIONS, FEATURE_MODULE_LABELS, FEATURE_MODULES } from "@/lib/permissions/feature-catalog";
import {
  ASSET_FIELD_KEYS,
  ASSET_FIELD_LABELS,
  DASHBOARD_WIDGET_KEYS,
  DASHBOARD_WIDGET_KIND,
  DASHBOARD_WIDGET_LABELS,
  DASHBOARD_WIDGET_SIZES,
  WORKFLOW_DESCRIPTIONS,
  WORKFLOW_KEYS,
  WORKFLOW_LABELS,
} from "@/lib/permissions/workspace-config";
import { updateWorkspaceSettingsAction } from "@/modules/companies/actions";
import type { CompanyWorkspaceSettings, UpdateWorkspaceSettingsState } from "@/modules/companies/types";

const initialState: UpdateWorkspaceSettingsState = { error: null };

function WidgetRows({
  widgets,
  namePrefix,
}: {
  widgets: Record<string, { enabled: boolean; order: number; size?: "sm" | "md" | "lg" } | undefined>;
  namePrefix: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      {DASHBOARD_WIDGET_KEYS.map((key) => (
        <label key={key} className="flex flex-wrap items-center gap-2 text-sm">
          <input
            type="checkbox"
            name={`${namePrefix}${key}`}
            defaultChecked={widgets[key]?.enabled !== false}
          />
          <span className="min-w-[12rem] flex-1">
            {DASHBOARD_WIDGET_LABELS[key]}
            <span className="ml-1 text-xs text-muted-foreground">({DASHBOARD_WIDGET_KIND[key]})</span>
          </span>
          <Input
            name={`${namePrefix}order_${key}`}
            type="number"
            className="w-20"
            defaultValue={widgets[key]?.order ?? 0}
            aria-label={`${DASHBOARD_WIDGET_LABELS[key]} order`}
          />
          <NativeSelect
            name={`${namePrefix}size_${key}`}
            className="w-24"
            defaultValue={widgets[key]?.size ?? (DASHBOARD_WIDGET_KIND[key] === "chart" ? "md" : "sm")}
            aria-label={`${DASHBOARD_WIDGET_LABELS[key]} size`}
          >
            {DASHBOARD_WIDGET_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </NativeSelect>
        </label>
      ))}
    </div>
  );
}

export function WorkspaceSettingsForm({
  settings,
  roles,
}: {
  settings: CompanyWorkspaceSettings;
  roles: { id: string; name: string }[];
}) {
  const [state, setState] = useState<UpdateWorkspaceSettingsState>(initialState);
  const [isPending, startTransition] = useTransition();
  const planLocked = settings.planModules !== null;
  const allowed = new Set(settings.planModules ?? FEATURE_MODULES);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await updateWorkspaceSettingsAction(initialState, formData);
      setState(result);
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-6 rounded-lg border p-4">
      <div>
        <h2 className="text-sm font-medium">Workspace configuration</h2>
        <p className="text-xs text-muted-foreground">
          Modules, fields, workflows, and dashboard widgets for this company. Disabled modules are
          hidden in the UI and blocked on the server. Plan restrictions cannot be overridden.
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="assetCodeFormat">Asset code format</Label>
        <Input id="assetCodeFormat" name="assetCodeFormat" defaultValue={settings.assetCodeFormat} required />
        <p className="text-xs text-muted-foreground">Must include {"{SEQ:05d}"}. Category prefixes override this when set.</p>
      </div>

      <section id="modules" className="flex flex-col gap-3 scroll-mt-20">
        <h3 className="text-sm font-medium">Modules</h3>
        {FEATURE_MODULES.map((module) => {
          const lockedOut = planLocked && !allowed.has(module);
          return (
            <label key={module} className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                name={`module_${module}`}
                defaultChecked={!lockedOut && settings.enabledModules[module] !== false}
                disabled={lockedOut}
                className="mt-1"
              />
              <span>
                <span className="font-medium">{FEATURE_MODULE_LABELS[module]}</span>
                <span className="block text-xs text-muted-foreground">
                  {lockedOut ? "Not included in your plan." : FEATURE_MODULE_DESCRIPTIONS[module]}
                </span>
              </span>
            </label>
          );
        })}
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-medium">Optional workflows</h3>
        {WORKFLOW_KEYS.map((key) => (
          <label key={key} className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              name={`workflow_${key}`}
              defaultChecked={settings.workflowConfig[key] === true}
              className="mt-1"
            />
            <span>
              <span className="font-medium">{WORKFLOW_LABELS[key]}</span>
              <span className="block text-xs text-muted-foreground">{WORKFLOW_DESCRIPTIONS[key]}</span>
            </span>
          </label>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-medium">Asset fields</h3>
        <p className="text-xs text-muted-foreground">
          Hide, rename, or require built-in fields. Name, category, location, and status stay required.
        </p>
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="p-2">Field</th>
                <th className="p-2">Label</th>
                <th className="p-2">On</th>
                <th className="p-2">Required</th>
                <th className="p-2">Order</th>
              </tr>
            </thead>
            <tbody>
              {ASSET_FIELD_KEYS.map((key) => {
                const field = settings.assetFieldConfig[key];
                return (
                  <tr key={key} className="border-b last:border-0">
                    <td className="p-2 text-muted-foreground">{ASSET_FIELD_LABELS[key]}</td>
                    <td className="p-2">
                      <Input name={`field_label_${key}`} defaultValue={field?.label ?? ASSET_FIELD_LABELS[key]} />
                    </td>
                    <td className="p-2">
                      <input type="checkbox" name={`field_enabled_${key}`} defaultChecked={field?.enabled !== false} />
                    </td>
                    <td className="p-2">
                      <input type="checkbox" name={`field_required_${key}`} defaultChecked={field?.required === true} />
                    </td>
                    <td className="p-2">
                      <Input
                        name={`field_order_${key}`}
                        type="number"
                        className="w-20"
                        defaultValue={field?.order ?? 0}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section id="dashboard" className="flex flex-col gap-3 scroll-mt-20">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-medium">Company dashboard</h3>
            <p className="text-xs text-muted-foreground">
              Default widgets for Company Admins and roles without a custom layout. Users still only
              see widgets they are entitled to.
            </p>
          </div>
          <Button type="submit" name="resetDashboard" value="1" variant="outline" size="sm" disabled={isPending}>
            Reset to default
          </Button>
        </div>
        <WidgetRows widgets={settings.dashboardWidgets} namePrefix="widget_" />
      </section>

      {roles.length > 0 ? (
        <section className="flex flex-col gap-4">
          <div>
            <h3 className="text-sm font-medium">Role dashboards</h3>
            <p className="text-xs text-muted-foreground">
              Optional layouts per role. Leave off to inherit the company dashboard.
            </p>
          </div>
          <input type="hidden" name="layoutRoleIds" value={roles.map((role) => role.id).join(",")} />
          {roles.map((role) => {
            const custom = settings.dashboardLayouts.roles[role.id];
            return (
              <details key={role.id} className="rounded-md border p-3" open={Boolean(custom)}>
                <summary className="cursor-pointer text-sm font-medium">{role.name}</summary>
                <label className="mt-3 flex items-center gap-2 text-sm">
                  <input type="checkbox" name={`role_layout_on_${role.id}`} defaultChecked={Boolean(custom)} />
                  Use a custom layout for this role
                </label>
                <div className="mt-3">
                  <WidgetRows widgets={custom ?? settings.dashboardWidgets} namePrefix={`role_${role.id}_widget_`} />
                </div>
              </details>
            );
          })}
        </section>
      ) : null}

      <div className="grid grid-cols-1 gap-4 @lg:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="departments">Departments (one per line)</Label>
          <Textarea id="departments" name="departments" rows={5} defaultValue={settings.departments.join("\n")} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="disposalMethods">Disposal methods (one per line)</Label>
          <Textarea
            id="disposalMethods"
            name="disposalMethods"
            rows={5}
            defaultValue={settings.disposalMethods.join("\n")}
          />
        </div>
      </div>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-emerald-600">Saved.</p> : null}
      <Button type="submit" disabled={isPending} className="self-start">
        {isPending ? "Saving..." : "Save configuration"}
      </Button>
    </form>
  );
}
