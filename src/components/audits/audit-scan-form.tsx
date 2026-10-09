"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, MapPin, Search, TriangleAlert, X } from "lucide-react";
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

/**
 * Two steps: (1) scan or type a code, (2) confirm "All good" in one tap or
 * open "Report a problem" for location/condition/exception details.
 */
export function AuditScanForm({
  auditId,
  locations,
  conditions,
  exceptionTypes,
  requireRemarkOnException = false,
  requirePhotoOnException = false,
}: {
  auditId: string;
  locations: AuditLocationOption[];
  conditions: { key: string; name: string }[];
  exceptionTypes: { key: string; name: string }[];
  requireRemarkOnException?: boolean;
  requirePhotoOnException?: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [match, setMatch] = useState<AuditItem | null>(null);
  const [reporting, setReporting] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [state, setState] = useState<AuditScanState>(initialState);
  const [isLookingUp, startLookup] = useTransition();
  const [isSaving, startSave] = useTransition();
  const queryRef = useRef<HTMLInputElement>(null);

  function reset() {
    setMatch(null);
    setReporting(false);
    setQuery("");
  }

  function lookupValue(value: string) {
    setLookupError(null);
    setState(initialState);
    startLookup(async () => {
      const result = await lookupAuditScanAction(auditId, value);
      if (result.error || !result.match) {
        setMatch(null);
        setLookupError(result.error ?? "This asset is not part of this audit.");
        return;
      }
      setMatch(result.match.item);
      setReporting(false);
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
        reset();
        router.refresh();
        queryRef.current?.focus();
      }
    });
  }

  const extraExceptionTypes = exceptionTypes.filter(
    (type) => type.key !== "wrong_location" && type.key !== "condition_mismatch",
  );

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4">
      {state.success && !match ? (
        <p role="status" className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
          <CheckCircle2 className="size-4 shrink-0" />
          {state.success} Scan the next one.
        </p>
      ) : null}

      {!match ? (
        <>
          <div>
            <h2 className="text-base font-semibold text-slate-900">Scan the next asset</h2>
            <p className="text-sm text-slate-500">Scan the TagX QR sticker, or type the asset code.</p>
          </div>
          <QrCameraScanner onResult={lookupValue} busy={isLookingUp} />
          <form action={handleLookup} className="flex gap-2">
            <Label htmlFor="query" className="sr-only">
              Asset code or tag link
            </Label>
            <Input
              ref={queryRef}
              id="query"
              name="query"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Type asset code, e.g. AST-00001"
              required
              inputMode="text"
              autoCapitalize="characters"
              className="h-11 min-w-0 flex-1"
            />
            <Button
              type="submit"
              variant="outline"
              disabled={isLookingUp}
              className="h-11 min-h-11 w-auto px-4"
              aria-label="Find asset"
            >
              {isLookingUp ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
              <span className="hidden sm:inline">{isLookingUp ? "Finding..." : "Find"}</span>
            </Button>
          </form>
          {lookupError ? (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-destructive">
              {lookupError}
            </p>
          ) : null}
        </>
      ) : (
        <form action={handleRecord} className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Found asset</p>
              <p className="truncate text-lg font-semibold text-slate-900">{match.assetName}</p>
              <p className="text-sm text-slate-500">{match.assetCode}</p>
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={reset} aria-label="Cancel and scan another">
              <X className="size-4" />
            </Button>
          </div>

          <dl className="grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-3 text-sm">
            <div>
              <dt className="flex items-center gap-1 text-xs text-slate-500">
                <MapPin className="size-3" /> Should be at
              </dt>
              <dd className="font-medium text-slate-900">{match.expectedLocationName ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Condition</dt>
              <dd className="font-medium text-slate-900">
                {match.expectedCondition ? formatCondition(match.expectedCondition) : "—"}
              </dd>
            </div>
          </dl>

          {match.status !== "unverified" ? (
            <label className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              <input type="checkbox" name="force" value="true" className="mt-0.5" required />
              Already scanned once. Tick to replace the previous scan.
            </label>
          ) : null}

          {!reporting ? (
            <>
              {/* "All good" = found exactly as expected, so the action records it as verified. */}
              <input type="hidden" name="foundLocationId" value={match.expectedLocationId ?? ""} />
              <input type="hidden" name="foundCondition" value={match.expectedCondition ?? ""} />
              <p className="text-sm font-medium text-slate-900">Is it here and in this condition?</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Button type="submit" disabled={isSaving} size="touch">
                  <CheckCircle2 className="size-4" />
                  {isSaving ? "Saving..." : "Yes, all good"}
                </Button>
                <Button type="button" variant="outline" size="touch" onClick={() => setReporting(true)}>
                  <TriangleAlert className="size-4" />
                  Report a problem
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="foundLocationId">Where is it now?</Label>
                  <NativeSelect id="foundLocationId" name="foundLocationId" defaultValue={match.expectedLocationId ?? ""}>
                    <option value="">Not set</option>
                    {locations.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.name}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="foundCondition">Actual condition</Label>
                  <NativeSelect id="foundCondition" name="foundCondition" defaultValue={match.expectedCondition ?? ""}>
                    <option value="">Not set</option>
                    {conditions.map((condition) => (
                      <option key={condition.key} value={condition.key}>
                        {condition.name}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              </div>
              {extraExceptionTypes.length > 0 ? (
                <fieldset className="flex flex-col gap-2">
                  <legend className="mb-1 text-sm font-medium">Other problems</legend>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {extraExceptionTypes.map((type) => (
                      <label key={type.key} className="flex min-h-10 items-center gap-2 rounded-md border px-3 text-sm">
                        <input type="checkbox" name="exceptionType" value={type.key} />
                        {type.name}
                      </label>
                    ))}
                  </div>
                </fieldset>
              ) : null}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="notes">Remark{requireRemarkOnException ? " (required)" : ""}</Label>
                <Textarea id="notes" name="notes" maxLength={2000} rows={2} placeholder="What's wrong?" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="photo">Photo{requirePhotoOnException ? " (required)" : " (optional)"}</Label>
                <Input id="photo" name="photo" type="file" accept="image/*" capture="environment" />
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Button type="submit" disabled={isSaving} size="touch">
                  {isSaving ? "Saving..." : "Save with problem"}
                </Button>
                <Button type="button" variant="ghost" size="touch" onClick={() => setReporting(false)}>
                  Back
                </Button>
              </div>
            </>
          )}

          {state.error ? (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-destructive">
              {state.error}
            </p>
          ) : null}
        </form>
      )}
    </section>
  );
}
