"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { ASSET_CONDITIONS } from "@/modules/assets/types";
import { recordAuditScanAction } from "@/modules/audits/actions";
import type { AuditScanState, AuditTagContext } from "@/modules/audits/types";

const initialState: AuditScanState = { error: null };

function formatCondition(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function AuditTagVerifyForm({ context }: { context: AuditTagContext }) {
  const router = useRouter();
  const [state, setState] = useState<AuditScanState>(initialState);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    formData.set("auditId", context.auditId);
    formData.set("assetId", context.item.assetId);
    startTransition(async () => {
      const result = await recordAuditScanAction(initialState, formData);
      setState(result);
      if (!result.error) {
        router.refresh();
      }
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-3 rounded-lg border p-4">
      <div>
        <h2 className="text-sm font-medium">Verify in audit</h2>
        <p className="text-xs text-muted-foreground">
          {context.auditName} · expected {context.item.expectedLocationName ?? "location unset"} /{" "}
          {context.item.expectedCondition ? formatCondition(context.item.expectedCondition) : "condition unset"}
        </p>
        {context.item.status !== "unverified" ? (
          <p className="mt-1 text-xs text-muted-foreground">
            Already {context.item.status === "verified" ? "verified" : "flagged"}
            {context.item.exceptionTypes.length > 0
              ? ` (${context.item.exceptionTypes.map((type) => type.replace(/_/g, " ")).join(", ")})`
              : ""}
            . You can record again to update this audit.
          </p>
        ) : null}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="foundLocationId">Found location</Label>
          <NativeSelect
            id="foundLocationId"
            name="foundLocationId"
            defaultValue={context.item.expectedLocationId ?? ""}
          >
            <option value="">Not set</option>
            {context.locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="foundCondition">Found condition</Label>
          <NativeSelect
            id="foundCondition"
            name="foundCondition"
            defaultValue={context.item.expectedCondition ?? ""}
          >
            <option value="">Not set</option>
            {ASSET_CONDITIONS.map((condition) => (
              <option key={condition} value={condition}>
                {formatCondition(condition)}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" name="notes" maxLength={2000} rows={2} />
      </div>
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      {state.success ? <p className="text-sm text-emerald-600">{state.success}</p> : null}
      <Button type="submit" disabled={isPending} className="self-start">
        {isPending ? "Recording..." : "Record in this audit"}
      </Button>
    </form>
  );
}
