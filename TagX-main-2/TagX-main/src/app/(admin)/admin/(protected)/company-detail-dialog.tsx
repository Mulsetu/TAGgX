"use client";

import { useEffect, useState, useTransition } from "react";
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
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteCompanyAction, updateCompanyAction } from "@/modules/companies/actions";
import type { CompanySummary, UpdateCompanyState } from "@/modules/companies/types";

const initialUpdateState: UpdateCompanyState = { error: null };

export function CompanyDetailDialog({
  company,
  open,
  onOpenChange,
}: {
  company: CompanySummary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [updateState, setUpdateState] = useState<UpdateCompanyState>(initialUpdateState);
  const [isDedicatedInfra, setIsDedicatedInfra] = useState(false);
  const [confirmSlug, setConfirmSlug] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isSaving, startSave] = useTransition();
  const [isDeleting, startDelete] = useTransition();

  useEffect(() => {
    if (company) {
      setIsDedicatedInfra(company.isDedicatedInfra);
      setUpdateState(initialUpdateState);
      setConfirmSlug("");
      setDeleteError(null);
    }
  }, [company]);

  if (!company) {
    return null;
  }

  function handleSave(formData: FormData) {
    if (isDedicatedInfra) {
      formData.set("isDedicatedInfra", "on");
    }

    startSave(async () => {
      const result = await updateCompanyAction(company!.id, initialUpdateState, formData);
      setUpdateState(result);
      if (result.success) {
        router.refresh();
      }
    });
  }

  function handleDelete() {
    setDeleteError(null);
    startDelete(async () => {
      const result = await deleteCompanyAction(company!.id);
      if (result.error) {
        setDeleteError(result.error);
        return;
      }
      onOpenChange(false);
      router.refresh();
    });
  }

  const canDelete = confirmSlug === company.slug;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{company.name}</DialogTitle>
          <DialogDescription>
            Created {new Date(company.createdAt).toLocaleDateString("en-US")}
          </DialogDescription>
        </DialogHeader>

        <form action={handleSave} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="detail-name">Company name</Label>
            <Input id="detail-name" name="name" defaultValue={company.name} required maxLength={200} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="detail-email">Admin email</Label>
            <Input id="detail-email" value={company.adminEmail ?? "—"} readOnly disabled />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="detail-slug">Slug</Label>
            <Input id="detail-slug" value={company.slug} readOnly disabled />
            <p className="text-xs text-muted-foreground">
              Read-only — used in this company&apos;s login URL and can&apos;t be changed.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="detail-isDedicatedInfra"
              checked={isDedicatedInfra}
              onCheckedChange={(checked) => setIsDedicatedInfra(checked === true)}
            />
            <Label htmlFor="detail-isDedicatedInfra" className="font-normal">
              Needs dedicated infrastructure
            </Label>
          </div>
          {updateState.error ? (
            <p role="alert" className="text-sm text-destructive">
              {updateState.error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </form>

        <div className="flex flex-col gap-2 rounded-lg border border-destructive/30 p-4">
          <p className="text-sm font-medium text-destructive">Danger zone</p>
          <p className="text-xs text-muted-foreground">
            Permanently deletes this company and everything under it — assets, users, roles,
            invites, and storage. The admin email becomes available again for a new company.
            This can&apos;t be undone.
          </p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="destructive" size="sm" className="self-start">
                Delete company
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {company.name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  Type the company slug <span className="font-mono font-semibold">{company.slug}</span> to
                  confirm. This deletes all of its data and frees up its admin email for reuse.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="confirm-slug">Slug</Label>
                <Input
                  id="confirm-slug"
                  value={confirmSlug}
                  onChange={(e) => setConfirmSlug(e.target.value)}
                  autoComplete="off"
                />
              </div>
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
                  disabled={!canDelete || isDeleting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {isDeleting ? "Deleting..." : "Delete permanently"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </DialogContent>
    </Dialog>
  );
}
