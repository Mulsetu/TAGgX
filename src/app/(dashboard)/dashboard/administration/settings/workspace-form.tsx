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

function useSettingsForm() {
  const [state, setState] = useState<UpdateWorkspaceSettingsState>(initialState);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await updateWorkspaceSettingsAction(initialState, formData);
      setState(result);
    });
  }

  return { state, isPending, handleSubmit };
}

function SaveNote({ state }: { state: UpdateWorkspaceSettingsState }) {
  return (
    <>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-emerald-600">Saved.</p> : null}
    </>
  );
}

export function ModulesForm({ settings }: { settings: CompanyWorkspaceSettings }) {
  const { state, isPending, handleSubmit } = useSettingsForm();
  const planLocked = settings.planModules !== null;
  const allowed = new Set(settings.planModules ?? FEATURE_MODULES);

  return (
    <form action={handleSubmit} className="flex max-w-2xl flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5">
      <input type="hidden" name="intent" value="modules" />
      <div>
        <h2 className="text-base font-semibold text-slate-900">Modules</h2>
        <p className="text-sm text-slate-500">
          Turn product areas on or off for this workspace. A module that is off is hidden and blocked on the server. Your plan still decides what can be turned on.
        </p>
      </div>
      <div className="flex flex-col gap-3">
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
                <span className="block text-xs text-slate-500">
                  {lockedOut ? "Not included in your plan." : FEATURE_MODULE_DESCRIPTIONS[module]}
                </span>
              </span>
            </label>
          );
        })}
      </div>
      <SaveNote state={state} />
      <Button type="submit" disabled={isPending} className="self-start">
        {isPending ? "Saving..." : "Save modules"}
      </Button>
    </form>
  );
}

export function DashboardForm({ settings }: { settings: CompanyWorkspaceSettings }) {
  const { state, isPending, handleSubmit } = useSettingsForm();

  return (
    <form action={handleSubmit} className="flex flex-col gap-6 rounded-xl border border-slate-200 bg-white p-5">
      <input type="hidden" name="intent" value="dashboard" />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Company dashboard</h2>
          <p className="text-sm text-slate-500">
            Widgets on the home dashboard. A person only sees the ones their role is allowed to open.
          </p>
        </div>
        <Button type="submit" name="resetDashboard" value="1" variant="outline" size="sm" disabled={isPending}>
          Reset to default
        </Button>
      </div>
      <WidgetRows widgets={settings.dashboardWidgets} namePrefix="widget_" />
      <SaveNote state={state} />
      <Button type="submit" disabled={isPending} className="self-start">
        {isPending ? "Saving..." : "Save dashboard"}
      </Button>
    </form>
  );
}

export function WorkspaceDetailsForm({ settings }: { settings: CompanyWorkspaceSettings }) {
  const { state, isPending, handleSubmit } = useSettingsForm();

  return (
    <form action={handleSubmit} className="flex max-w-3xl flex-col gap-5 rounded-xl border border-slate-200 bg-white p-5">
      <input type="hidden" name="intent" value="workspace" />
      <div>
        <h2 className="text-base font-semibold text-slate-900">Workspace</h2>
        <p className="text-sm text-slate-500">Optional workflows, and the lists used on asset forms. Asset codes are set from the category prefix.</p>
      </div>
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
              <span className="block text-xs text-slate-500">{WORKFLOW_DESCRIPTIONS[key]}</span>
            </span>
          </label>
        ))}
      </section>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
      <SaveNote state={state} />
      <Button type="submit" disabled={isPending} className="self-start">
        {isPending ? "Saving..." : "Save workspace"}
      </Button>
    </form>
  );
}

export function BuiltinFieldsForm({ settings }: { settings: CompanyWorkspaceSettings }) {
  const { state, isPending, handleSubmit } = useSettingsForm();

  return (
    <form action={handleSubmit} className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5">
      <input type="hidden" name="intent" value="fields" />
      <div>
        <h2 className="text-base font-semibold text-slate-900">Built-in fields</h2>
        <p className="text-sm text-slate-500">
          Hide, rename, or require fields that already exist on every asset. Name, category, location, and status stay required.
        </p>
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-slate-500">
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
                  <td className="p-2 text-slate-500">{ASSET_FIELD_LABELS[key]}</td>
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
      <SaveNote state={state} />
      <Button type="submit" disabled={isPending} className="self-start">
        {isPending ? "Saving..." : "Save built-in fields"}
      </Button>
    </form>
  );
}
