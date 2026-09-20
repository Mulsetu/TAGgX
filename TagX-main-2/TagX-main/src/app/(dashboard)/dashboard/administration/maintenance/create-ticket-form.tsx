"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { createTicketAction } from "@/modules/maintenance/actions";
import type { MaintenanceFormState } from "@/modules/maintenance/types";
import type { AssetOption } from "@/modules/assets/types";

const initialState: MaintenanceFormState = { error: null };

export function CreateTicketForm({ assets }: { assets: AssetOption[] }) {
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
      <Button type="submit" disabled={isPending} className="self-start">
        {isPending ? "Creating..." : "Create ticket"}
      </Button>
    </form>
  );
}
