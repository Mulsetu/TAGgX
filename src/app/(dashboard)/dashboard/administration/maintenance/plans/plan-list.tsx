"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createPlanAction,
  deletePlanAction,
  setPlanActiveAction,
  updatePlanAction,
} from "@/modules/maintenance/actions";
import type { MaintenanceFormState, MaintenancePlanSummary } from "@/modules/maintenance/types";
import type { AssetOption } from "@/modules/assets/types";
import type { VendorOption } from "@/modules/vendors/types";

const FREQUENCIES = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "half_yearly", label: "Half-yearly" },
  { value: "yearly", label: "Yearly" },
  { value: "custom", label: "Custom days" },
] as const;

const initialState: MaintenanceFormState = { error: null };

export function PlanList({
  plans,
  assets,
  vendors,
  users,
}: {
  plans: MaintenancePlanSummary[];
  assets: AssetOption[];
  vendors: VendorOption[];
  users: AssetOption[];
}) {
  const router = useRouter();
  const [state, setState] = useState<MaintenanceFormState>(initialState);
  const [isPending, startTransition] = useTransition();
  const assetName = new Map(assets.map((asset) => [asset.id, asset.name]));

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createPlanAction(initialState, formData);
      setState(result);
      if (!result.error) {
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <form action={handleSubmit} className="flex flex-col gap-3 rounded-lg border p-4">
        <p className="text-sm font-medium">New plan</p>
        <div className="grid grid-cols-1 gap-3 @sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required maxLength={200} placeholder="Quarterly AMC check" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="assetId">Asset</Label>
            <NativeSelect id="assetId" name="assetId" required defaultValue="">
              <option value="" disabled>
                Select an asset
              </option>
              {assets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="frequency">Frequency</Label>
            <NativeSelect id="frequency" name="frequency" defaultValue="monthly">
              {FREQUENCIES.map((frequency) => (
                <option key={frequency.value} value={frequency.value}>
                  {frequency.label}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="intervalDays">Custom interval (days)</Label>
            <Input id="intervalDays" name="intervalDays" type="number" min={1} max={3650} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nextDueAt">Next due</Label>
            <Input id="nextDueAt" name="nextDueAt" type="date" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="vendorId">Vendor</Label>
            <NativeSelect id="vendorId" name="vendorId" defaultValue="">
              <option value="">None</option>
              {vendors.map((vendor) => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="assignedTo">Assignee</Label>
            <NativeSelect id="assignedTo" name="assignedTo" defaultValue="">
              <option value="">Unassigned</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-1.5 @sm:col-span-2">
            <Label htmlFor="checklist">Checklist</Label>
            <Input id="checklist" name="checklist" maxLength={4000} placeholder="Inspect, clean, replace filters" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="estimatedCost">Estimated cost</Label>
            <Input id="estimatedCost" name="estimatedCost" type="number" min={0} step="0.01" />
          </div>
          <div className="flex flex-col gap-1.5 @sm:col-span-2">
            <Label htmlFor="instructions">Instructions</Label>
            <Input id="instructions" name="instructions" maxLength={4000} />
          </div>
        </div>
        {state.error ? (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        ) : null}
        <Button type="submit" disabled={isPending} className="w-full sm:w-auto" size="touch">
          {isPending ? "Saving..." : "Create plan"}
        </Button>
      </form>

      {plans.length === 0 ? (
        <p className="rounded-lg border p-4 text-center text-sm text-muted-foreground">No preventive plans yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Asset</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead>Next due</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[1%]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map((plan) => (
                <TableRow key={plan.id}>
                  <TableCell className="font-medium">{plan.name}</TableCell>
                  <TableCell className="text-muted-foreground">{assetName.get(plan.assetId) ?? plan.assetId}</TableCell>
                  <TableCell className="capitalize text-muted-foreground">{plan.frequency.replace("_", " ")}</TableCell>
                  <TableCell className="text-muted-foreground">{plan.nextDueAt}</TableCell>
                  <TableCell className="text-muted-foreground">{plan.isActive ? "Active" : "Paused"}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isPending}
                        onClick={() =>
                          startTransition(async () => {
                            setState(await setPlanActiveAction(plan.id, !plan.isActive));
                            router.refresh();
                          })
                        }
                      >
                        {plan.isActive ? "Pause" : "Resume"}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={isPending}
                        onClick={() =>
                          startTransition(async () => {
                            setState(await deletePlanAction(plan.id));
                            router.refresh();
                          })
                        }
                      >
                        Delete
                      </Button>
                    </div>
                    <form
                      action={(formData) => {
                        startTransition(async () => {
                          const result = await updatePlanAction(plan.id, initialState, formData);
                          setState(result);
                          if (!result.error) {
                            router.refresh();
                          }
                        });
                      }}
                      className="mt-2 grid grid-cols-2 gap-2"
                    >
                      <input type="hidden" name="assetId" value={plan.assetId} />
                      <Input name="name" defaultValue={plan.name} required maxLength={200} />
                      <Input name="nextDueAt" type="date" defaultValue={plan.nextDueAt} required />
                      <input type="hidden" name="frequency" value={plan.frequency} />
                      <Input name="checklist" defaultValue={plan.checklist ?? ""} placeholder="Checklist" />
                      <Input name="estimatedCost" type="number" min={0} step="0.01" defaultValue={plan.estimatedCost ?? ""} />
                      <Input name="instructions" defaultValue={plan.instructions ?? ""} placeholder="Instructions" className="col-span-2" />
                      <Button type="submit" size="sm" disabled={isPending} className="col-span-2 w-fit">
                        Save
                      </Button>
                    </form>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
