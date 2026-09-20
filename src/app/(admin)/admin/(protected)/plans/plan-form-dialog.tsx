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
import { Textarea } from "@/components/ui/textarea";
import { createPlanAction, deletePlanAction, updatePlanAction } from "@/modules/billing/actions";
import type { BillingPlan, PlanFormState } from "@/modules/billing/types";
import { FEATURE_MODULE_LABELS, FEATURE_MODULES } from "@/lib/permissions/feature-catalog";

const initialState: PlanFormState = { error: null };

export function PlanFormDialog({
  mode,
  plan,
  open,
  onOpenChange,
}: {
  mode: "create" | "edit";
  plan: BillingPlan | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [state, setState] = useState<PlanFormState>(initialState);
  const [isActive, setIsActive] = useState(true);
  const [allModules, setAllModules] = useState(true);
  const [isSaving, startSave] = useTransition();
  const [isDeleting, startDelete] = useTransition();

  useEffect(() => {
    setIsActive(plan?.isActive ?? true);
    setAllModules(plan?.includedModules == null);
    setState(initialState);
  }, [plan, open]);

  function handleSave(formData: FormData) {
    if (isActive) {
      formData.set("isActive", "on");
    } else {
      formData.delete("isActive");
    }
    if (allModules) {
      formData.set("allModules", "on");
    } else {
      formData.delete("allModules");
    }

    startSave(async () => {
      const result =
        mode === "edit" && plan
          ? await updatePlanAction(plan.id, initialState, formData)
          : await createPlanAction(initialState, formData);
      setState(result);
      if (result.success) {
        onOpenChange(false);
        router.refresh();
      }
    });
  }

  function handleDelete() {
    if (!plan) {
      return;
    }
    startDelete(async () => {
      const result = await deletePlanAction(plan.id);
      setState(result);
      if (!result.error) {
        onOpenChange(false);
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "edit" ? "Edit plan" : "New plan"}</DialogTitle>
          <DialogDescription>
            Price, asset cap, storage, and which modules companies on this plan may enable.
          </DialogDescription>
        </DialogHeader>

        <form action={handleSave} key={`${mode}-${plan?.id ?? "new"}`} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="plan-name">Name</Label>
            <Input id="plan-name" name="name" required maxLength={80} defaultValue={plan?.name ?? ""} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="plan-description">Description</Label>
            <Textarea
              id="plan-description"
              name="description"
              maxLength={500}
              defaultValue={plan?.description ?? ""}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 @sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="priceMonthly">Price per month (₹)</Label>
              <Input
                id="priceMonthly"
                name="priceMonthly"
                type="number"
                min={0}
                step={1}
                required
                defaultValue={plan?.priceMonthly ?? 6999}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="assetLimit">Included assets</Label>
              <Input
                id="assetLimit"
                name="assetLimit"
                type="number"
                min={1}
                step={1}
                required
                defaultValue={plan?.assetLimit ?? 500}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="extraAssetQuantity">Extra pack size</Label>
              <Input
                id="extraAssetQuantity"
                name="extraAssetQuantity"
                type="number"
                min={1}
                step={1}
                required
                defaultValue={plan?.extraAssetQuantity ?? 100}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="extraAssetPrice">Extra pack price (₹)</Label>
              <Input
                id="extraAssetPrice"
                name="extraAssetPrice"
                type="number"
                min={0}
                step={1}
                required
                defaultValue={plan?.extraAssetPrice ?? 1499}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sortOrder">Sort order</Label>
              <Input
                id="sortOrder"
                name="sortOrder"
                type="number"
                min={0}
                step={1}
                defaultValue={plan?.sortOrder ?? 0}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="userLimit">User limit</Label>
              <Input
                id="userLimit"
                name="userLimit"
                type="number"
                min={1}
                step={1}
                defaultValue={plan?.userLimit ?? ""}
                placeholder="Unlimited"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="storageLimitGb">Storage (GiB)</Label>
              <Input
                id="storageLimitGb"
                name="storageLimitGb"
                type="number"
                min={0}
                step={1}
                defaultValue={plan?.storageLimitBytes != null ? Math.round(plan.storageLimitBytes / (1024 * 1024 * 1024)) : 5}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="isActive"
              checked={isActive}
              onCheckedChange={(checked) => setIsActive(checked === true)}
            />
            <Label htmlFor="isActive" className="font-normal">
              List on the public pricing page
            </Label>
          </div>
          <div className="flex flex-col gap-2 rounded-md border p-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="allModules"
                checked={allModules}
                onCheckedChange={(checked) => setAllModules(checked === true)}
              />
              <Label htmlFor="allModules" className="font-normal">
                Include every current and future module
              </Label>
            </div>
            {!allModules ? (
              <div className="grid grid-cols-1 gap-2 @sm:grid-cols-2">
                {FEATURE_MODULES.map((module) => (
                  <label key={module} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="includedModule"
                      value={module}
                      defaultChecked={plan?.includedModules?.includes(module) ?? true}
                    />
                    {FEATURE_MODULE_LABELS[module]}
                  </label>
                ))}
              </div>
            ) : null}
          </div>
          {state.error ? (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : mode === "edit" ? "Save plan" : "Create plan"}
            </Button>
          </DialogFooter>
        </form>

        {mode === "edit" && plan ? (
          <div className="flex flex-col gap-2 rounded-lg border border-destructive/30 p-4">
            <p className="text-sm font-medium text-destructive">Delete plan</p>
            <p className="text-xs text-muted-foreground">
              Only unused plans can be deleted. Reassign companies first if this one is in use.
            </p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="destructive" size="sm" className="self-start">
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {plan.name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This removes the plan from the public pricing page. Companies already on it
                    must be moved first.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(event) => {
                      event.preventDefault();
                      handleDelete();
                    }}
                    disabled={isDeleting}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {isDeleting ? "Deleting..." : "Delete plan"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
