"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitPublicAssetReportAction } from "@/modules/assets/actions";
import type { PublicAssetReportState } from "@/modules/assets/types";

const initialState: PublicAssetReportState = { error: null };

export function PublicAssetReportForm({ assetId }: { assetId: string }) {
  const [state, setState] = useState<PublicAssetReportState>(initialState);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    formData.set("assetId", assetId);
    startTransition(async () => {
      const result = await submitPublicAssetReportAction(initialState, formData);
      setState(result);
    });
  }

  if (state.success) {
    return (
      <p className="rounded-md border bg-muted/40 p-3 text-sm">
        Thanks — your report was submitted. The team that owns this asset will follow up if they
        need more information.
      </p>
    );
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Your name</Label>
        <Input id="name" name="name" required maxLength={200} autoComplete="name" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required maxLength={320} autoComplete="email" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="message">What happened?</Label>
        <Textarea id="message" name="message" required maxLength={2000} rows={4} />
      </div>
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={isPending} size="touch">
        {isPending ? "Submitting..." : "Submit report"}
      </Button>
    </form>
  );
}
