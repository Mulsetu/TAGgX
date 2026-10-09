"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { StatusBadge } from "@/components/assets/status-badge";
import { ColorInput } from "@/components/setup/color-input";
import { SafeDeleteDialog } from "@/components/setup/safe-delete-dialog";
import { SortableList } from "@/components/setup/sortable-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  createConditionAction,
  deleteConditionAction,
  reorderConditionsAction,
  updateConditionAction,
} from "@/modules/conditions/actions";
import type { ConditionFormState, ConditionSummary } from "@/modules/conditions/types";

const initialState: ConditionFormState = { error: null };

function keyFromName(name: string): string {
  const key = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return /^[a-z]/.test(key) ? key.slice(0, 64) : `c_${key}`.slice(0, 64);
}

function ConditionDialog({
  condition,
  onOpenChange,
  nextSortOrder,
  usageCount,
  others,
  canEdit,
}: {
  condition: ConditionSummary | null;
  onOpenChange: (open: boolean) => void;
  nextSortOrder: number;
  usageCount: number;
  others: ConditionSummary[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [state, setState] = useState<ConditionFormState>(initialState);
  const [isSaving, startSave] = useTransition();
  const [name, setName] = useState(condition?.name ?? "");
  const [color, setColor] = useState(condition?.color ?? "");
  // The key is stored on assets and audits, so it's fixed once created.
  const key = condition?.key ?? keyFromName(name);

  function handleSave(formData: FormData) {
    startSave(async () => {
      const result = condition
        ? await updateConditionAction(condition.id, initialState, formData)
        : await createConditionAction(initialState, formData);
      setState(result);
      if (!result.error) {
        onOpenChange(false);
        router.refresh();
      }
    });
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {condition ? "Edit condition" : "New condition"}
            {condition?.isSystem ? <Badge variant="secondary">Default</Badge> : null}
          </DialogTitle>
        </DialogHeader>
        <form action={handleSave} className="flex flex-col gap-4">
          <input type="hidden" name="sortOrder" value={condition?.sortOrder ?? nextSortOrder} />
          <input type="hidden" name="key" value={key} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="condition-name">Name</Label>
            <Input id="condition-name" name="name" value={name} onChange={(event) => setName(event.target.value)} required maxLength={100} disabled={!canEdit} />
            <p className="text-xs text-slate-500">
              Saved as <span className="font-mono">{key || "…"}</span>
              {condition ? " — fixed, because assets and audits store it." : "."}
            </p>
          </div>
          <ColorInput id="condition-color" name="color" label="Colour" value={color} onChange={setColor} swatches />
          <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
            Preview on assets: <StatusBadge name={name || "Condition"} color={color || null} />
          </div>
          <label className="flex items-start justify-between gap-4 text-sm">
            <span>
              <span className="font-medium text-slate-900">Available on forms</span>
              <span className="block text-xs text-slate-500">Turn off to retire a condition without touching assets that already use it.</span>
            </span>
            <Switch name="isActive" defaultChecked={condition?.isActive ?? true} disabled={!canEdit} />
          </label>
          {state.error ? <p role="alert" className="text-sm text-destructive">{state.error}</p> : null}
          <DialogFooter className="items-center gap-2 sm:justify-between">
            {condition && canEdit ? (
              <SafeDeleteDialog
                itemName={condition.name}
                kind="condition"
                usageCount={usageCount}
                options={others.map((other) => ({ id: other.id, name: other.name }))}
                onDelete={(replacementId) => deleteConditionAction(condition.id, replacementId)}
                onDeleted={() => {
                  onOpenChange(false);
                  router.refresh();
                }}
              />
            ) : (
              <span />
            )}
            {canEdit ? (
              <Button type="submit" disabled={isSaving || !key}>
                {isSaving ? "Saving..." : condition ? "Save changes" : "Create condition"}
              </Button>
            ) : null}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ConditionList({
  conditions,
  usage,
  canEdit,
}: {
  conditions: ConditionSummary[];
  usage: Record<string, number>;
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState<ConditionSummary | null>(null);
  const [creating, setCreating] = useState(false);
  const nextSortOrder = conditions.length > 0 ? Math.max(...conditions.map((row) => row.sortOrder)) + 1 : 1;

  return (
    <div className="flex max-w-3xl flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-500">
          {canEdit ? "Drag or use the arrows to set the order shown on forms and audits." : "The order shown on forms and audits."}
        </p>
        {canEdit ? (
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" /> New condition
          </Button>
        ) : null}
      </div>

      {conditions.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-white p-6 text-center text-sm text-slate-500">No conditions yet.</p>
      ) : (
        <SortableList
          items={conditions}
          canEdit={canEdit}
          onReorder={reorderConditionsAction}
          renderItem={(condition) => {
            const count = usage[condition.id] ?? 0;
            return (
              <button type="button" onClick={() => setEditing(condition)} className="flex w-full flex-wrap items-center gap-2 text-left">
                <StatusBadge name={condition.name} color={condition.color} className={condition.isActive ? undefined : "opacity-50"} />
                {!condition.isActive ? <span className="text-xs text-slate-500">Hidden from forms</span> : null}
                {condition.isSystem ? <Badge variant="secondary" className="text-[10px]">Default</Badge> : null}
                <span className="ml-auto flex items-center gap-2 text-xs text-slate-500">
                  {count.toLocaleString("en-IN")} asset{count === 1 ? "" : "s"}
                  <Pencil className="size-3.5 text-slate-300" />
                </span>
              </button>
            );
          }}
        />
      )}

      {editing ? (
        <ConditionDialog
          key={editing.id}
          condition={editing}
          onOpenChange={(open) => !open && setEditing(null)}
          nextSortOrder={nextSortOrder}
          usageCount={usage[editing.id] ?? 0}
          others={conditions.filter((condition) => condition.id !== editing.id)}
          canEdit={canEdit}
        />
      ) : null}
      {creating ? (
        <ConditionDialog
          condition={null}
          onOpenChange={setCreating}
          nextSortOrder={nextSortOrder}
          usageCount={0}
          others={[]}
          canEdit={canEdit}
        />
      ) : null}
    </div>
  );
}
