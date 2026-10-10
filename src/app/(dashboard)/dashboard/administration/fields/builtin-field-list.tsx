"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { EyeOff, Lock, Pencil } from "lucide-react";
import { SortableList } from "@/components/setup/sortable-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { reorderBuiltinFieldsAction, updateBuiltinFieldAction } from "@/modules/companies/actions";
import type { UpdateWorkspaceSettingsState } from "@/modules/companies/types";

export interface BuiltinFieldRow {
  id: string;
  defaultLabel: string;
  label: string;
  enabled: boolean;
  required: boolean;
}

const LOCKED_FIELDS = ["Name", "Category", "Location", "Status"];
const initialState: UpdateWorkspaceSettingsState = { error: null };

function BuiltinFieldDialog({
  field,
  canEdit,
  onOpenChange,
}: {
  field: BuiltinFieldRow;
  canEdit: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [state, setState] = useState<UpdateWorkspaceSettingsState>(initialState);
  const [label, setLabel] = useState(field.label);
  const [enabled, setEnabled] = useState(field.enabled);
  const [isSaving, startSave] = useTransition();

  function handleSave(formData: FormData) {
    startSave(async () => {
      const result = await updateBuiltinFieldAction(field.id, initialState, formData);
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
            Edit field
            {field.label !== field.defaultLabel ? (
              <span className="text-sm font-normal text-slate-500">({field.defaultLabel})</span>
            ) : null}
          </DialogTitle>
        </DialogHeader>
        <form action={handleSave} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="builtin-label">Label</Label>
            <div className="flex gap-2">
              <Input
                id="builtin-label"
                name="label"
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                required
                maxLength={80}
                disabled={!canEdit}
              />
              {canEdit && label !== field.defaultLabel ? (
                <Button type="button" variant="outline" onClick={() => setLabel(field.defaultLabel)}>
                  Reset
                </Button>
              ) : null}
            </div>
          </div>
          <label className="flex items-start justify-between gap-4 text-sm">
            <span>
              <span className="font-medium text-slate-900">Show on assets</span>
              <span className="block text-xs text-slate-500">Hidden fields disappear from the asset form, pages, and import.</span>
            </span>
            <Switch name="enabled" checked={enabled} onCheckedChange={setEnabled} disabled={!canEdit} />
          </label>
          <label className="flex items-start justify-between gap-4 text-sm">
            <span>
              <span className="font-medium text-slate-900">Required</span>
              <span className="block text-xs text-slate-500">Assets can&apos;t be saved or imported without it.</span>
            </span>
            <Switch name="required" defaultChecked={field.required} disabled={!canEdit || !enabled} />
          </label>
          {state.error ? (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          ) : null}
          {canEdit ? (
            <DialogFooter>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Saving..." : "Save changes"}
              </Button>
            </DialogFooter>
          ) : null}
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function BuiltinFieldList({ fields, canEdit }: { fields: BuiltinFieldRow[]; canEdit: boolean }) {
  const [editing, setEditing] = useState<BuiltinFieldRow | null>(null);
  const hiddenCount = fields.filter((field) => !field.enabled).length;

  return (
    <div className="flex max-w-3xl flex-col gap-3">
      <p className="text-sm text-slate-500">
        Fields every asset already has. Rename, hide, or require them
        {canEdit ? "; drag or use the arrows to set the order on the asset form." : "."}
        {hiddenCount > 0 ? ` ${hiddenCount} hidden.` : ""}
      </p>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-600">
        <Lock className="size-3.5 text-slate-400" />
        Always shown and required:
        {LOCKED_FIELDS.map((name) => (
          <Badge key={name} variant="secondary" className="text-[11px]">
            {name}
          </Badge>
        ))}
      </div>

      <SortableList
        items={fields}
        canEdit={canEdit}
        onReorder={reorderBuiltinFieldsAction}
        renderItem={(field) => (
          <button type="button" onClick={() => setEditing(field)} className="flex w-full flex-wrap items-center gap-2 text-left">
            <span className={field.enabled ? "font-medium text-slate-900" : "font-medium text-slate-400 line-through"}>
              {field.label}
            </span>
            {field.label !== field.defaultLabel ? (
              <span className="text-xs text-slate-400">({field.defaultLabel})</span>
            ) : null}
            {!field.enabled ? (
              <span className="flex items-center gap-1 text-xs text-slate-500">
                <EyeOff className="size-3" /> Hidden
              </span>
            ) : field.required ? (
              <span className="text-xs text-slate-500">Required</span>
            ) : null}
            <Pencil className="ml-auto size-3.5 text-slate-300" />
          </button>
        )}
      />

      {editing ? (
        <BuiltinFieldDialog
          key={editing.id}
          field={editing}
          canEdit={canEdit}
          onOpenChange={(open) => !open && setEditing(null)}
        />
      ) : null}
    </div>
  );
}
