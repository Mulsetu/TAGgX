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
import {
  createConditionAction,
  deleteConditionAction,
  updateConditionAction,
} from "@/modules/conditions/actions";
import type { ConditionFormState, ConditionSummary } from "@/modules/conditions/types";

const initialState: ConditionFormState = { error: null };

function ConditionFormFields({
  condition,
  nextSortOrder,
}: {
  condition?: ConditionSummary;
  nextSortOrder: number;
}) {
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" defaultValue={condition?.name} required maxLength={100} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="key">Key</Label>
        <Input id="key" name="key" defaultValue={condition?.key} required maxLength={64} />
        <p className="text-xs text-muted-foreground">Stored on assets and audits. Lowercase, no spaces.</p>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="color">Color</Label>
        <Input id="color" name="color" defaultValue={condition?.color ?? ""} placeholder="#0F6E7A" maxLength={7} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sortOrder">Sort order</Label>
        <Input
          id="sortOrder"
          name="sortOrder"
          type="number"
          min={0}
          defaultValue={condition?.sortOrder ?? nextSortOrder}
          required
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isActive" defaultChecked={condition?.isActive ?? true} />
        Active
      </label>
    </>
  );
}

export function ConditionList({ conditions }: { conditions: ConditionSummary[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<ConditionSummary | null>(null);
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [state, setState] = useState<ConditionFormState>(initialState);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const nextSortOrder = conditions.length > 0 ? Math.max(...conditions.map((row) => row.sortOrder)) + 1 : 1;

  function handleCreate(formData: FormData) {
    startTransition(async () => {
      const result = await createConditionAction(initialState, formData);
      setState(result);
      if (!result.error) {
        setCreateOpen(false);
        setState(initialState);
        router.refresh();
      }
    });
  }

  function handleSave(formData: FormData) {
    if (!selected) return;
    startTransition(async () => {
      const result = await updateConditionAction(selected.id, initialState, formData);
      setState(result);
      if (!result.error) {
        router.refresh();
      }
    });
  }

  function handleDelete() {
    if (!selected) return;
    setDeleteError(null);
    startTransition(async () => {
      const result = await deleteConditionAction(selected.id);
      if (result.error) {
        setDeleteError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>New condition</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New condition</DialogTitle>
            </DialogHeader>
            <form action={handleCreate} className="flex flex-col gap-4">
              <ConditionFormFields nextSortOrder={nextSortOrder} />
              {state.error && createOpen ? (
                <p role="alert" className="text-sm text-destructive">
                  {state.error}
                </p>
              ) : null}
              <DialogFooter>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Creating..." : "Create condition"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Key</TableHead>
              <TableHead>Sort</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {conditions.map((condition) => (
              <TableRow
                key={condition.id}
                className="cursor-pointer"
                onClick={() => {
                  setSelected(condition);
                  setOpen(true);
                  setState(initialState);
                }}
              >
                <TableCell className="font-medium">{condition.name}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{condition.key}</TableCell>
                <TableCell className="text-muted-foreground">{condition.sortOrder}</TableCell>
                <TableCell>
                  {condition.isActive ? null : <Badge variant="outline">Inactive</Badge>}
                  {condition.isSystem ? <Badge variant="secondary">Default</Badge> : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selected?.name}</DialogTitle>
          </DialogHeader>
          {selected ? (
            <form action={handleSave} className="flex flex-col gap-4">
              <ConditionFormFields condition={selected} nextSortOrder={selected.sortOrder} />
              {state.error && open ? (
                <p role="alert" className="text-sm text-destructive">
                  {state.error}
                </p>
              ) : null}
              <DialogFooter className="sm:justify-between">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button type="button" variant="destructive" size="sm">
                      Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete {selected.name}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Disable the condition instead if assets still use this key.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    {deleteError ? <p className="text-sm text-destructive">{deleteError}</p> : null}
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={(event) => { event.preventDefault(); handleDelete(); }}>
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Saving..." : "Save changes"}
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
