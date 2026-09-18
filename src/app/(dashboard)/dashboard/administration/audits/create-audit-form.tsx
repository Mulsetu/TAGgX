"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
import { NativeSelect } from "@/components/ui/native-select";
import { createAuditAction } from "@/modules/audits/actions";
import type { AuditFormState, AuditLocationOption } from "@/modules/audits/types";

const initialState: AuditFormState = { error: null };

export function CreateAuditForm({ locations }: { locations: AuditLocationOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<AuditFormState>(initialState);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createAuditAction(initialState, formData);
      setState(result);
      if (!result.error && result.id) {
        setOpen(false);
        setState(initialState);
        router.push(`/dashboard/administration/audits/${result.id}`);
        return;
      }
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
        <Button>New audit</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create audit campaign</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required maxLength={200} placeholder="Q3 warehouse count" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="scheduledDate">Date</Label>
            <Input
              id="scheduledDate"
              name="scheduledDate"
              type="date"
              required
              defaultValue={new Date().toLocaleDateString("en-CA")}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="locationId">Scope</Label>
            <NativeSelect id="locationId" name="locationId" defaultValue="">
              <option value="">All locations</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </NativeSelect>
            <p className="text-xs text-muted-foreground">
              Assets in this scope are snapshotted now so the audit keeps its own history.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="requireRemarkOnException" />
            Require a remark on exceptions
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="requirePhotoOnException" />
            Require a photo on exceptions
          </label>
          {state.error ? (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Creating..." : "Create campaign"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
