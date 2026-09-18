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
import { NativeSelect } from "@/components/ui/native-select";
import { assignPlanToCompanyAction, grantExtraAssetsAction } from "@/modules/billing/actions";
import type { AssignPlanState, BillingPlan, CompanyBillingSnapshot } from "@/modules/billing/types";
import { deleteCompanyAction, setCompanySuspendedAction, updateCompanyAction } from "@/modules/companies/actions";
import type { CompanySummary, UpdateCompanyState } from "@/modules/companies/types";

const initialUpdateState: UpdateCompanyState = { error: null };
const initialPlanState: AssignPlanState = { error: null };

export function CompanyDetailDialog({
  company,
  billing,
  plans,
  open,
  onOpenChange,
}: {
  company: CompanySummary | null;
  billing: CompanyBillingSnapshot | null;
  plans: BillingPlan[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [updateState, setUpdateState] = useState<UpdateCompanyState>(initialUpdateState);
  const [planState, setPlanState] = useState<AssignPlanState>(initialPlanState);
  const [grantState, setGrantState] = useState<AssignPlanState>(initialPlanState);
  const [isDedicatedInfra, setIsDedicatedInfra] = useState(false);
  const [confirmSlug, setConfirmSlug] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isSaving, startSave] = useTransition();
  const [isDeleting, startDelete] = useTransition();
  const [isPlanSaving, startPlanSave] = useTransition();
  const [isGranting, startGrant] = useTransition();
  const [isSuspending, startSuspend] = useTransition();
  const [suspendError, setSuspendError] = useState<string | null>(null);

  useEffect(() => {
    if (company) {
      setIsDedicatedInfra(company.isDedicatedInfra);
      setUpdateState(initialUpdateState);
      setPlanState(initialPlanState);
      setGrantState(initialPlanState);
      setConfirmSlug("");
      setDeleteError(null);
      setSuspendError(null);
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

  function handleAssignPlan(formData: FormData) {
    startPlanSave(async () => {
      const result = await assignPlanToCompanyAction(company!.id, initialPlanState, formData);
      setPlanState(result);
      if (result.success) {
        router.refresh();
      }
    });
  }

  function handleGrant(formData: FormData) {
    startGrant(async () => {
      const result = await grantExtraAssetsAction(company!.id, initialPlanState, formData);
      setGrantState(result);
      if (result.success) {
        router.refresh();
      }
    });
  }

  function handleSuspend() {
    setSuspendError(null);
    startSuspend(async () => {
      const result = await setCompanySuspendedAction(company!.id, !company!.suspendedAt);
      if (result.error) {
        setSuspendError(result.error);
        return;
      }
      router.refresh();
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
      <DialogContent className="max-h-[90vh] overflow-y-auto">
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

        <form action={handleAssignPlan} className="flex flex-col gap-3 rounded-lg border p-4">
          <p className="text-sm font-medium">Plan</p>
          <p className="text-xs text-muted-foreground">
            {billing?.effectiveLimit !== null && billing?.effectiveLimit !== undefined
              ? `${billing.assetCount.toLocaleString("en-IN")} of ${billing.effectiveLimit.toLocaleString("en-IN")} assets used${billing.extraAssets > 0 ? ` (includes +${billing.extraAssets.toLocaleString("en-IN")} extra)` : ""}.`
              : "No plan assigned — this company currently has no asset cap."}
          </p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="detail-planId">Assigned plan</Label>
            <NativeSelect
              key={billing?.planId ?? "none"}
              id="detail-planId"
              name="planId"
              defaultValue={billing?.planId ?? ""}
              required
            >
              <option value="" disabled>
                Choose a plan
              </option>
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name} — {plan.assetLimit.toLocaleString("en-IN")} assets
                </option>
              ))}
            </NativeSelect>
          </div>
          {planState.error ? (
            <p role="alert" className="text-sm text-destructive">
              {planState.error}
            </p>
          ) : null}
          {planState.success ? <p className="text-sm text-emerald-600">Plan saved.</p> : null}
          <Button type="submit" variant="outline" size="sm" className="self-start" disabled={isPlanSaving}>
            {isPlanSaving ? "Saving..." : "Assign plan"}
          </Button>
        </form>

        <div className="flex flex-col gap-2 rounded-lg border p-4">
          <p className="text-sm font-medium">Access</p>
          <p className="text-xs text-muted-foreground">
            {company.suspendedAt
              ? `Suspended ${new Date(company.suspendedAt).toLocaleString("en-IN")}. Tenant login is blocked.`
              : "Active. Tenant members can sign in."}
          </p>
          {suspendError ? (
            <p role="alert" className="text-sm text-destructive">
              {suspendError}
            </p>
          ) : null}
          <Button type="button" variant="outline" size="sm" className="self-start" disabled={isSuspending} onClick={handleSuspend}>
            {isSuspending ? "Saving..." : company.suspendedAt ? "Restore access" : "Suspend organization"}
          </Button>
        </div>

        <form action={handleGrant} className="flex flex-col gap-3 rounded-lg border p-4">
          <p className="text-sm font-medium">Grant extra assets</p>
          <p className="text-xs text-muted-foreground">
            Use this after an offline payment, or to raise the cap without a pack order.
          </p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="detail-quantity">Assets to add</Label>
            <Input id="detail-quantity" name="quantity" type="number" min={1} step={1} required defaultValue={100} />
          </div>
          {grantState.error ? (
            <p role="alert" className="text-sm text-destructive">
              {grantState.error}
            </p>
          ) : null}
          {grantState.success ? <p className="text-sm text-emerald-600">Extra assets added.</p> : null}
          <Button type="submit" variant="outline" size="sm" className="self-start" disabled={isGranting}>
            {isGranting ? "Adding..." : "Add extra assets"}
          </Button>
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
