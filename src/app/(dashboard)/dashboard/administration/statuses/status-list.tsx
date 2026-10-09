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
  createStatusAction,
  deleteStatusAction,
  reorderStatusesAction,
  updateStatusAction,
} from "@/modules/statuses/actions";
import type { StatusFormState, StatusSummary } from "@/modules/statuses/types";

const initialState: StatusFormState = { error: null };

function StatusDialog({
  status,
  open,
  onOpenChange,
  nextSortOrder,
  usageCount,
  others,
  canEdit,
}: {
  status: StatusSummary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nextSortOrder: number;
  usageCount: number;
  others: StatusSummary[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [state, setState] = useState<StatusFormState>(initialState);
  const [isSaving, startSave] = useTransition();
  const [name, setName] = useState(status?.name ?? "");
  const [color, setColor] = useState(status?.color ?? "");

  function handleSave(formData: FormData) {
    startSave(async () => {
      const result = status
        ? await updateStatusAction(status.id, initialState, formData)
        : await createStatusAction(initialState, formData);
      setState(result);
      if (!result.error) {
        onOpenChange(false);
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {status ? "Edit status" : "New status"}
            {status?.isSystem ? <Badge variant="secondary">Default</Badge> : null}
          </DialogTitle>
        </DialogHeader>
        <form action={handleSave} className="flex flex-col gap-4">
          <input type="hidden" name="sortOrder" value={status?.sortOrder ?? nextSortOrder} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="status-name">Name</Label>
            <Input id="status-name" name="name" value={name} onChange={(event) => setName(event.target.value)} required maxLength={100} disabled={!canEdit} />
          </div>
          <ColorInput id="status-color" name="color" label="Colour" value={color} onChange={setColor} swatches />
          <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
            Preview on assets: <StatusBadge name={name || "Status"} color={color || null} />
          </div>
          <label className="flex items-start justify-between gap-4 text-sm">
            <span>
              <span className="font-medium text-slate-900">Final status</span>
              <span className="block text-xs text-slate-500">For retired, disposed or lost assets. Disposal moves assets here.</span>
            </span>
            <Switch name="isFinal" defaultChecked={status?.isFinal ?? false} disabled={!canEdit} />
          </label>
          <label className="flex items-start justify-between gap-4 text-sm">
            <span>
              <span className="font-medium text-slate-900">Can be assigned</span>
              <span className="block text-xs text-slate-500">Assets in this status can be handed over to someone.</span>
            </span>
            <Switch name="allowsAssignment" defaultChecked={status?.allowsAssignment ?? true} disabled={!canEdit} />
          </label>
          {state.error ? <p role="alert" className="text-sm text-destructive">{state.error}</p> : null}
          <DialogFooter className="items-center gap-2 sm:justify-between">
            {status && canEdit ? (
              <SafeDeleteDialog
                itemName={status.name}
                kind="status"
                usageCount={usageCount}
                options={others.map((other) => ({ id: other.id, name: other.name }))}
                onDelete={(replacementId) => deleteStatusAction(status.id, replacementId)}
                onDeleted={() => {
                  onOpenChange(false);
                  router.refresh();
                }}
              />
            ) : (
              <span />
            )}
            {canEdit ? (
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Saving..." : status ? "Save changes" : "Create status"}
              </Button>
            ) : null}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function StatusList({
  statuses,
  usage,
  canEdit,
}: {
  statuses: StatusSummary[];
  usage: Record<string, number>;
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState<StatusSummary | null>(null);
  const [creating, setCreating] = useState(false);
  const nextSortOrder = statuses.length > 0 ? Math.max(...statuses.map((s) => s.sortOrder)) + 1 : 1;

  return (
    <div className="flex max-w-3xl flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-500">
          {canEdit ? "Drag or use the arrows to set the order shown in dropdowns and charts." : "The order shown in dropdowns and charts."}
        </p>
        {canEdit ? (
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" /> New status
          </Button>
        ) : null}
      </div>

      {statuses.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-white p-6 text-center text-sm text-slate-500">No statuses yet.</p>
      ) : (
        <SortableList
          items={statuses}
          canEdit={canEdit}
          onReorder={reorderStatusesAction}
          renderItem={(status) => {
            const count = usage[status.id] ?? 0;
            return (
              <button type="button" onClick={() => setEditing(status)} className="flex w-full flex-wrap items-center gap-2 text-left">
                <StatusBadge name={status.name} color={status.color} />
                {status.isFinal ? <span className="text-xs text-slate-500">Final</span> : null}
                {!status.allowsAssignment ? <span className="text-xs text-slate-500">· Can&apos;t be assigned</span> : null}
                {status.isSystem ? <Badge variant="secondary" className="text-[10px]">Default</Badge> : null}
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
        <StatusDialog
          key={editing.id}
          status={editing}
          open
          onOpenChange={(open) => !open && setEditing(null)}
          nextSortOrder={nextSortOrder}
          usageCount={usage[editing.id] ?? 0}
          others={statuses.filter((status) => status.id !== editing.id)}
          canEdit={canEdit}
        />
      ) : null}
      {creating ? (
        <StatusDialog
          status={null}
          open
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
