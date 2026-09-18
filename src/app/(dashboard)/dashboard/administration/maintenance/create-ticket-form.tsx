"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { createTicketAction } from "@/modules/maintenance/actions";
import { MAINTENANCE_PRIORITIES, type MaintenanceFormState } from "@/modules/maintenance/types";
import type { AssetOption } from "@/modules/assets/types";
import type { VendorOption } from "@/modules/vendors/types";

const initialState: MaintenanceFormState = { error: null };

export function CreateTicketForm({
  assets,
  vendors,
  types,
}: {
  assets: AssetOption[];
  vendors: VendorOption[];
  types: { key: string; name: string }[];
}) {
  const router = useRouter();
  const [state, setState] = useState<MaintenanceFormState>(initialState);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createTicketAction(initialState, formData);
      setState(result);
      if (!result.error) {
        router.refresh();
      }
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-3 rounded-lg border p-4">
      <p className="text-sm font-medium">New ticket</p>
      <div className="grid grid-cols-1 gap-3 @sm:grid-cols-2">
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
          <Label htmlFor="title">Title</Label>
          <Input id="title" name="title" required maxLength={200} placeholder="e.g. Screen flickering" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="typeKey">Type</Label>
          <NativeSelect id="typeKey" name="typeKey" defaultValue="corrective">
            {(types.length > 0 ? types : [{ key: "corrective", name: "Corrective" }]).map((type) => (
              <option key={type.key} value={type.key}>
                {type.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="priority">Priority</Label>
          <NativeSelect id="priority" name="priority" defaultValue="normal">
            {MAINTENANCE_PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {priority}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dueAt">Due date</Label>
          <Input id="dueAt" name="dueAt" type="date" />
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
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" maxLength={2000} rows={2} />
      </div>
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={isPending} className="w-full sm:w-auto" size="touch">
        {isPending ? "Creating..." : "Create ticket"}
      </Button>
    </form>
  );
}
