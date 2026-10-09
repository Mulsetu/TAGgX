"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";

/**
 * Delete that knows how many assets use the item. Unused → plain confirm.
 * In use → pick where those assets move first (or, when `noneLabel` is
 * given, deliberately leave them without one).
 */
export function SafeDeleteDialog({
  itemName,
  kind,
  usageCount,
  options,
  noneLabel,
  onDelete,
  onDeleted,
}: {
  itemName: string;
  kind: string;
  usageCount: number;
  options: { id: string; name: string }[];
  noneLabel?: string;
  onDelete: (replacementId?: string) => Promise<{ error: string | null }>;
  onDeleted: () => void;
}) {
  const [replacement, setReplacement] = useState(options[0]?.id ?? (noneLabel ? "" : ""));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inUse = usageCount > 0;
  const blocked = inUse && options.length === 0 && !noneLabel;

  function confirm() {
    setError(null);
    startTransition(async () => {
      const result = await onDelete(inUse && replacement ? replacement : undefined);
      if (result.error) {
        setError(result.error);
        return;
      }
      onDeleted();
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive">
          <Trash2 className="size-4" />
          Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {itemName}?</AlertDialogTitle>
          <AlertDialogDescription>
            {inUse
              ? `${usageCount} asset${usageCount === 1 ? " uses" : "s use"} this ${kind}. Choose where to move ${usageCount === 1 ? "it" : "them"} before deleting.`
              : `No assets use this ${kind}. This can't be undone.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {inUse && !blocked ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="safe-delete-target">Move assets to</Label>
            <NativeSelect id="safe-delete-target" value={replacement} onChange={(event) => setReplacement(event.target.value)}>
              {options.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
              {noneLabel ? <option value="">{noneLabel}</option> : null}
            </NativeSelect>
          </div>
        ) : null}
        {blocked ? <p className="text-sm text-destructive">Create another {kind} first so these assets have somewhere to go.</p> : null}
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault();
              confirm();
            }}
            disabled={isPending || blocked}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending ? "Deleting..." : inUse ? "Move and delete" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
