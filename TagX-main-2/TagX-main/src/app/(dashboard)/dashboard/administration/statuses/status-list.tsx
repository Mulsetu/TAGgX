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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createStatusAction, deleteStatusAction, updateStatusAction } from "@/modules/statuses/actions";
import type { StatusFormState, StatusSummary } from "@/modules/statuses/types";

const initialState: StatusFormState = { error: null };

function StatusFormFields({ status, nextSortOrder }: { status?: StatusSummary; nextSortOrder: number }) {
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" defaultValue={status?.name} required maxLength={100} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sortOrder">Sort order</Label>
        <Input
          id="sortOrder"
          name="sortOrder"
          type="number"
          min={0}
          defaultValue={status?.sortOrder ?? nextSortOrder}
          required
        />
        <p className="text-xs text-muted-foreground">Lower numbers show first in dropdowns and charts.</p>
      </div>
    </>
  );
}

function CreateStatusDialog({ nextSortOrder }: { nextSortOrder: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<StatusFormState>(initialState);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createStatusAction(initialState, formData);
      setState(result);
      if (!result.error) {
        setOpen(false);
        setState(initialState);
        router.refresh();
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setState(initialState);
      }}
    >
      <DialogTrigger asChild>
        <Button>New status</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New status</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="flex flex-col gap-4">
          <StatusFormFields nextSortOrder={nextSortOrder} />
          {state.error ? (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Creating..." : "Create status"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditStatusDialog({
  status,
  open,
  onOpenChange,
}: {
  status: StatusSummary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [state, setState] = useState<StatusFormState>(initialState);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isSaving, startSave] = useTransition();
  const [isDeleting, startDelete] = useTransition();

  if (!status) return null;

  function handleSave(formData: FormData) {
    startSave(async () => {
      const result = await updateStatusAction(status!.id, initialState, formData);
      setState(result);
      if (!result.error) {
        router.refresh();
      }
    });
  }

  function handleDelete() {
    setDeleteError(null);
    startDelete(async () => {
      const result = await deleteStatusAction(status!.id);
      if (result.error) {
        setDeleteError(result.error);
        return;
      }
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {status.name}
            {status.isSystem ? <Badge variant="secondary">Default</Badge> : null}
          </DialogTitle>
        </DialogHeader>
        <form action={handleSave} className="flex flex-col gap-4">
          <StatusFormFields status={status} nextSortOrder={status.sortOrder} />
          {state.error ? (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          ) : null}
          <DialogFooter className="items-center sm:justify-between">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="destructive" size="sm">
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {status.name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    You can&apos;t delete a status while any asset is still set to it. This can&apos;t
                    be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                {deleteError ? (
                  <p role="alert" className="text-sm text-destructive">
                    {deleteError}
                  </p>
                ) : null}
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(e) => {
                      e.preventDefault();
                      handleDelete();
                    }}
                    disabled={isDeleting}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {isDeleting ? "Deleting..." : "Delete"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function StatusList({ statuses }: { statuses: StatusSummary[] }) {
  const [selected, setSelected] = useState<StatusSummary | null>(null);
  const [open, setOpen] = useState(false);
  const nextSortOrder = statuses.length > 0 ? Math.max(...statuses.map((s) => s.sortOrder)) + 1 : 1;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <CreateStatusDialog nextSortOrder={nextSortOrder} />
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Sort order</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {statuses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                  No statuses yet.
                </TableCell>
              </TableRow>
            ) : (
              statuses.map((status) => (
                <TableRow
                  key={status.id}
                  className="cursor-pointer"
                  onClick={() => {
                    setSelected(status);
                    setOpen(true);
                  }}
                >
                  <TableCell className="font-medium">{status.name}</TableCell>
                  <TableCell className="text-muted-foreground">{status.sortOrder}</TableCell>
                  <TableCell>{status.isSystem ? <Badge variant="secondary">Default</Badge> : null}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <EditStatusDialog status={selected} open={open} onOpenChange={setOpen} />
    </div>
  );
}
