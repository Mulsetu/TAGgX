"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { QrCameraScanner } from "@/components/audits/qr-camera-scanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { lookupAuditScanAction, recordAuditScanAction } from "@/modules/audits/actions";
import type { AuditItem, AuditLocationOption, AuditScanState } from "@/modules/audits/types";

const initialState: AuditScanState = { error: null };

function formatCondition(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function AuditScanForm({
  auditId,
  locations,
  conditions,
  exceptionTypes,
}: {
  auditId: string;
  locations: AuditLocationOption[];
  conditions: { key: string; name: string }[];
  exceptionTypes: { key: string; name: string }[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [match, setMatch] = useState<AuditItem | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [state, setState] = useState<AuditScanState>(initialState);
  const [isLookingUp, startLookup] = useTransition();
  const [isSaving, startSave] = useTransition();

  function lookupValue(value: string) {
    setLookupError(null);
    setState(initialState);
    startLookup(async () => {
      const result = await lookupAuditScanAction(auditId, value);
      if (result.error || !result.match) {
        setMatch(null);
        setLookupError(result.error ?? "Asset not found in this audit.");
        return;
      }
      setMatch(result.match.item);
      setQuery(value);
    });
  }

  function handleLookup(formData: FormData) {
    lookupValue(String(formData.get("query") ?? ""));
  }

  function handleRecord(formData: FormData) {
    formData.set("auditId", auditId);
    if (match) {
      formData.set("assetId", match.assetId);
    }
    startSave(async () => {
      const result = await recordAuditScanAction(initialState, formData);
      setState(result);
      if (!result.error) {
        setMatch(null);
        setQuery("");
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border p-4">
      <div>
        <p className="text-sm font-medium">Scan or enter an asset</p>
        <p className="text-xs text-muted-foreground">
          Point this phone at the TagX sticker, or type the asset code.
        </p>
      </div>
      <QrCameraScanner onResult={lookupValue} />
      <form action={handleLookup} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <Label htmlFor="query">Asset code or tag link</Label>
          <Input
            id="query"
            name="query"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="/tag/… or AST-00001"
            required
            inputMode="text"
            autoCapitalize="characters"
          />
        </div>
        <Button type="submit" variant="outline" disabled={isLookingUp} className="sm:w-auto" size="touch">
          {isLookingUp ? "Looking up..." : "Find in audit"}
        </Button>
      </form>
      {lookupError ? (
        <p role="alert" className="text-sm text-destructive">
          {lookupError}
        </p>
      ) : null}

      {match ? (
        <form action={handleRecord} className="flex flex-col gap-3 rounded-md border p-3">
          <p className="text-base font-medium">
            {match.assetName}{" "}
            <span className="font-normal text-muted-foreground">{match.assetCode}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            Expected location: {match.expectedLocationName ?? "—"} · Expected condition:{" "}
            {match.expectedCondition ? formatCondition(match.expectedCondition) : "—"}
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="foundLocationId">Found location</Label>
              <NativeSelect
                id="foundLocationId"
                name="foundLocationId"
                defaultValue={match.expectedLocationId ?? ""}
              >
                <option value="">Not set</option>
                {locations.map((location) => (
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
                defaultValue={match.expectedCondition ?? ""}
              >
                <option value="">Not set</option>
                {conditions.map((condition) => (
                  <option key={condition.key} value={condition.key}>
                    {condition.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>
          {exceptionTypes.length > 0 ? (
            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm font-medium">Additional exceptions</legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {exceptionTypes
                  .filter((type) => type.key !== "wrong_location" && type.key !== "condition_mismatch")
                  .map((type) => (
                    <label key={type.key} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="exceptionType" value={type.key} />
                      {type.name}
                    </label>
                  ))}
              </div>
            </fieldset>
          ) : null}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" maxLength={2000} rows={2} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="photo">Exception photo</Label>
            <Input id="photo" name="photo" type="file" accept="image/*" />
          </div>
          {match.status !== "unverified" ? (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="force" value="true" />
              Replace the previous scan
            </label>
          ) : null}
          {state.error ? (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          ) : null}
          <Button type="submit" disabled={isSaving} size="touch">
            {isSaving ? "Recording..." : "Record verification"}
          </Button>
        </form>
      ) : null}

      {state.success && !match ? <p className="text-sm text-emerald-600">{state.success}</p> : null}
    </div>
  );
}
