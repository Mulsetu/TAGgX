"use client";

import { useState, useTransition } from "react";
import { Lock, Plus, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { FEATURE_MODULE_DESCRIPTIONS, FEATURE_MODULE_LABELS, FEATURE_MODULES, type FeatureModule } from "@/lib/permissions/feature-catalog";
import {
  DASHBOARD_WIDGET_KEYS,
  DASHBOARD_WIDGET_LABELS,
  WORKFLOW_DESCRIPTIONS,
  WORKFLOW_KEYS,
  WORKFLOW_LABELS,
  type DashboardWidgetKey,
  type WorkflowKey,
} from "@/lib/permissions/workspace-config";
import { updateWorkspaceSettingsAction } from "@/modules/companies/actions";
import type { CompanyWorkspaceSettings, UpdateWorkspaceSettingsState } from "@/modules/companies/types";

const initialState: UpdateWorkspaceSettingsState = { error: null };

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

/** Sticky footer so Save is always one tap away on long settings pages. */
function SaveBar({ state, isPending, label, children }: { state: UpdateWorkspaceSettingsState; isPending: boolean; label: string; children?: React.ReactNode }) {
  return (
    <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center gap-3 border-t border-slate-200 bg-[#F4F7FB]/95 px-1 py-3 backdrop-blur">
      <Button type="submit" disabled={isPending}>
        {isPending ? "Saving..." : label}
      </Button>
      {children}
      <SaveNote state={state} />
    </div>
  );
}

function Group({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {description ? <p className="text-xs text-slate-500">{description}</p> : null}
      </div>
      <ul className="divide-y divide-slate-100">{children}</ul>
    </section>
  );
}

function ToggleRow({
  name,
  label,
  description,
  defaultChecked,
  disabled,
  badge,
}: {
  name: string;
  label: string;
  description?: string;
  defaultChecked: boolean;
  disabled?: boolean;
  badge?: React.ReactNode;
}) {
  return (
    <li>
      <label className={cn("flex items-start justify-between gap-4 px-4 py-3", disabled ? "cursor-not-allowed" : "cursor-pointer")}>
        <span className="min-w-0">
          <span className={cn("flex flex-wrap items-center gap-2 text-sm font-medium", disabled ? "text-slate-400" : "text-slate-900")}>
            {label}
            {badge}
          </span>
          {description ? <span className="block text-xs text-slate-500">{description}</span> : null}
        </span>
        <Switch name={name} defaultChecked={defaultChecked} disabled={disabled} className="mt-0.5" />
      </label>
    </li>
  );
}

// ---------------------------------------------------------------- Modules

const MODULE_GROUPS: { title: string; description: string; modules: FeatureModule[] }[] = [
  {
    title: "Asset records",
    description: "What every asset page holds.",
    modules: ["assets", "qr", "documents", "custom_fields", "departments", "financial", "lifecycle"],
  },
  {
    title: "Custody",
    description: "Moving assets between people and places.",
    modules: ["handover", "transfers", "disposal", "approvals"],
  },
  {
    title: "Operations",
    description: "Keeping assets checked and working.",
    modules: ["audits", "maintenance", "preventive_maintenance", "vendors"],
  },
  {
    title: "Insights & communication",
    description: "Reports and automatic emails.",
    modules: ["reports", "email"],
  },
];

export function ModulesForm({ settings }: { settings: CompanyWorkspaceSettings }) {
  const { state, isPending, handleSubmit } = useSettingsForm();
  const planLocked = settings.planModules !== null;
  const allowed = new Set(settings.planModules ?? FEATURE_MODULES);
  const onCount = FEATURE_MODULES.filter((module) => allowed.has(module) && settings.enabledModules[module] !== false).length;

  return (
    <form action={handleSubmit} className="flex max-w-4xl flex-col gap-4">
      <input type="hidden" name="intent" value="modules" />
      <div>
        <h2 className="text-base font-semibold text-slate-900">Modules</h2>
        <p className="text-sm text-slate-500">
          {onCount} of {FEATURE_MODULES.length} areas are on. A module that&apos;s off disappears from menus and is blocked on
          the server; turning it back on restores everything.
        </p>
      </div>
      <div className="grid gap-4 @3xl:grid-cols-2">
        {MODULE_GROUPS.map((group) => (
          <Group key={group.title} title={group.title} description={group.description}>
            {group.modules.map((module) => {
              const lockedOut = planLocked && !allowed.has(module);
              return (
                <ToggleRow
                  key={module}
                  name={`module_${module}`}
                  label={FEATURE_MODULE_LABELS[module]}
                  description={FEATURE_MODULE_DESCRIPTIONS[module]}
                  defaultChecked={!lockedOut && settings.enabledModules[module] !== false}
                  disabled={lockedOut}
                  badge={
                    lockedOut ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                        <Lock className="size-3" /> Not in your plan
                      </span>
                    ) : null
                  }
                />
              );
            })}
          </Group>
        ))}
      </div>
      <SaveBar state={state} isPending={isPending} label="Save modules" />
    </form>
  );
}

// ---------------------------------------------------------------- Dashboard

const WIDGET_GROUPS: { title: string; keys: DashboardWidgetKey[] }[] = [
  { title: "Headline numbers", keys: ["total_assets", "active_assets", "missing_assets", "unassigned_assets", "assets_under_maintenance"] },
  { title: "Charts", keys: ["by_location", "by_category", "by_status", "open_tickets"] },
  { title: "Maintenance & expiry", keys: ["maintenance_due", "upcoming_maintenance", "warranty_expiry", "amc_expiry", "insurance_expiry", "document_expiry"] },
  { title: "Audits & approvals", keys: ["audit_progress", "pending_audits", "open_exceptions", "missing_from_audit", "pending_approvals"] },
  { title: "Workspace", keys: ["vendor_summary", "storage_usage"] },
];

export function DashboardForm({ settings }: { settings: CompanyWorkspaceSettings }) {
  const { state, isPending, handleSubmit } = useSettingsForm();
  const grouped = new Set(WIDGET_GROUPS.flatMap((group) => group.keys));
  const ungrouped = DASHBOARD_WIDGET_KEYS.filter((key) => !grouped.has(key));
  const groups = ungrouped.length > 0 ? [...WIDGET_GROUPS, { title: "Other", keys: ungrouped }] : WIDGET_GROUPS;

  return (
    <form action={handleSubmit} className="flex max-w-4xl flex-col gap-4">
      <input type="hidden" name="intent" value="dashboard" />
      <div>
        <h2 className="text-base font-semibold text-slate-900">Home dashboard</h2>
        <p className="text-sm text-slate-500">
          Choose the cards on everyone&apos;s home dashboard. People only see the cards their role and modules allow.
        </p>
      </div>
      {/* Order and size aren't edited here; keep what's stored so saving doesn't reset them. */}
      {DASHBOARD_WIDGET_KEYS.map((key) => (
        <span key={key} hidden>
          <input type="hidden" name={`widget_order_${key}`} value={settings.dashboardWidgets[key]?.order ?? 0} />
          <input type="hidden" name={`widget_size_${key}`} value={settings.dashboardWidgets[key]?.size ?? "sm"} />
        </span>
      ))}
      <div className="grid gap-4 @3xl:grid-cols-2">
        {groups.map((group) => (
          <Group key={group.title} title={group.title}>
            {group.keys.map((key) => (
              <ToggleRow
                key={key}
                name={`widget_${key}`}
                label={DASHBOARD_WIDGET_LABELS[key]}
                defaultChecked={settings.dashboardWidgets[key]?.enabled !== false}
              />
            ))}
          </Group>
        ))}
      </div>
      <SaveBar state={state} isPending={isPending} label="Save dashboard">
        <Button type="submit" name="resetDashboard" value="1" variant="ghost" disabled={isPending}>
          <RotateCcw className="size-4" />
          Reset to default
        </Button>
      </SaveBar>
    </form>
  );
}

// ---------------------------------------------------------------- Workspace

/** Workflows that actually change behaviour today; the others are stored for a later release. */
const LIVE_WORKFLOWS: WorkflowKey[] = ["transfer_approval", "disposal_approval"];

function ChipList({ name, label, description, initial, placeholder }: { name: string; label: string; description: string; initial: string[]; placeholder: string }) {
  const [items, setItems] = useState(initial);
  const [draft, setDraft] = useState("");

  function add() {
    const value = draft.trim();
    if (!value || items.some((item) => item.toLowerCase() === value.toLowerCase())) {
      setDraft("");
      return;
    }
    setItems([...items, value]);
    setDraft("");
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">{label}</h3>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
      <input type="hidden" name={name} value={items.join("\n")} />
      {items.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {items.map((item) => (
            <li key={item} className="inline-flex items-center gap-1 rounded-full bg-slate-100 py-1 pl-3 pr-1 text-sm text-slate-700">
              {item}
              <button
                type="button"
                onClick={() => setItems(items.filter((entry) => entry !== item))}
                className="grid size-5 place-items-center rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                aria-label={`Remove ${item}`}
              >
                <X className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-400">None yet.</p>
      )}
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          maxLength={80}
          className="min-w-0 flex-1"
        />
        <Button type="button" variant="outline" onClick={add} disabled={!draft.trim()}>
          <Plus className="size-4" />
          Add
        </Button>
      </div>
    </section>
  );
}

export function WorkspaceDetailsForm({ settings }: { settings: CompanyWorkspaceSettings }) {
  const { state, isPending, handleSubmit } = useSettingsForm();

  return (
    <form action={handleSubmit} className="flex max-w-4xl flex-col gap-4">
      <input type="hidden" name="intent" value="workspace" />
      <div>
        <h2 className="text-base font-semibold text-slate-900">Workspace</h2>
        <p className="text-sm text-slate-500">Rules for how work flows, and the pick-lists used on asset forms.</p>
      </div>
      {/* Reserved workflows keep their stored value; they don't affect anything yet. */}
      {WORKFLOW_KEYS.filter((key) => !LIVE_WORKFLOWS.includes(key)).map((key) =>
        settings.workflowConfig[key] ? <input key={key} type="hidden" name={`workflow_${key}`} value="on" /> : null,
      )}
      <Group title="Approvals" description="Extra checks before certain changes go through.">
        {LIVE_WORKFLOWS.map((key) => (
          <ToggleRow
            key={key}
            name={`workflow_${key}`}
            label={WORKFLOW_LABELS[key]}
            description={WORKFLOW_DESCRIPTIONS[key]}
            defaultChecked={settings.workflowConfig[key] === true}
          />
        ))}
      </Group>
      <div className="grid gap-4 @3xl:grid-cols-2">
        <ChipList
          name="departments"
          label="Departments"
          description="Shown in the Department field on assets."
          initial={settings.departments}
          placeholder="e.g. Finance"
        />
        <ChipList
          name="disposalMethods"
          label="Disposal methods"
          description="Choices when an asset is disposed of."
          initial={settings.disposalMethods}
          placeholder="e.g. Sold, Scrapped"
        />
      </div>
      <SaveBar state={state} isPending={isPending} label="Save workspace" />
    </form>
  );
}
