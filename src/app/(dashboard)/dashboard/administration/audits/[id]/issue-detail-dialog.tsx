"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, ExternalLink, ImageOff, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { mediaSrc } from "@/lib/media-url";
import { raiseAuditTicketAction, resolveAuditItemAction } from "@/modules/audits/actions";
import { auditExceptionLabel } from "@/modules/audits/types";
import type { AuditFormState, AuditItem } from "@/modules/audits/types";
import type { AssetOption } from "@/modules/assets/types";

const initialState: AuditFormState = { error: null };

function formatCondition(value: string | null): string {
  if (!value) return "—";
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function CompareRow({ label, expected, found }: { label: string; expected: string; found: string }) {
  const differs = found !== "—" && found !== expected;
  return (
    <tr className="border-t border-slate-100">
      <th scope="row" className="py-2 pr-3 text-left text-xs font-medium text-slate-500">
        {label}
      </th>
      <td className="py-2 pr-3 text-slate-700">{expected}</td>
      <td className={cn("py-2", differs ? "font-semibold text-red-600" : "text-slate-700")}>{found}</td>
    </tr>
  );
}

/**
 * Everything an admin needs to act on one audit problem: the photo at full
 * size, expected vs found side by side, the auditor's remark, and the two
 * follow-ups — raise a maintenance ticket and/or mark it resolved.
 */
export function IssueDetailDialog({
  auditId,
  item,
  users,
  canEdit,
  canRaiseTicket,
  onClose,
}: {
  auditId: string;
  item: AuditItem | null;
  users: AssetOption[];
  canEdit: boolean;
  canRaiseTicket: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"view" | "ticket" | "resolve">("view");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [photoFailed, setPhotoFailed] = useState(false);

  function close() {
    setMode("view");
    setError(null);
    setPhotoFailed(false);
    onClose();
  }

  function submit(action: (state: AuditFormState, formData: FormData) => Promise<AuditFormState>, formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await action(initialState, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      close();
      router.refresh();
    });
  }

  const photo = item ? mediaSrc(item.exceptionPhotoPath) : null;
  const open = item !== null;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent className="sm:max-w-2xl">
        {item ? (
          <>
            <DialogHeader>
              <DialogTitle className="pr-6">{item.assetName}</DialogTitle>
              <DialogDescription>
                {item.assetCode}
                {item.scannedAt ? ` · checked ${new Date(item.scannedAt).toLocaleString("en-GB")}` : ""}
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-wrap gap-1.5">
              {item.exceptionTypes.length > 0 ? (
                item.exceptionTypes.map((type) => (
                  <Badge key={type} variant="destructive">
                    {auditExceptionLabel(type)}
                  </Badge>
                ))
              ) : (
                <Badge variant="destructive">Problem</Badge>
              )}
              {item.resolved ? <Badge variant="secondary">Resolved</Badge> : null}
              {item.maintenanceTicketId ? (
                <Badge variant="outline" className="gap-1">
                  <Wrench className="size-3" /> Ticket raised
                </Badge>
              ) : null}
            </div>

            <div className="grid gap-4 @lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              {photo && !photoFailed ? (
                <a
                  href={photo}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative block overflow-hidden rounded-lg border bg-slate-50"
                >
                  {/* Proxied private R2 object — same-company session required. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo}
                    alt={`Photo of the problem on ${item.assetCode}`}
                    className="max-h-72 w-full object-contain"
                    onError={() => setPhotoFailed(true)}
                  />
                  <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-md bg-black/60 px-2 py-1 text-xs text-white">
                    <ExternalLink className="size-3" /> Open full size
                  </span>
                </a>
              ) : (
                <div className="flex min-h-32 flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-sm text-slate-400">
                  <ImageOff className="size-5" />
                  {photo ? "Photo could not be loaded" : "No photo attached"}
                </div>
              )}

              <div className="flex flex-col gap-3 text-sm">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-xs text-slate-400">
                      <th className="pb-1 font-medium" />
                      <th className="pb-1 font-medium">Expected</th>
                      <th className="pb-1 font-medium">Found</th>
                    </tr>
                  </thead>
                  <tbody>
                    <CompareRow
                      label="Location"
                      expected={item.expectedLocationName ?? "—"}
                      found={item.foundLocationName ?? "—"}
                    />
                    <CompareRow
                      label="Condition"
                      expected={formatCondition(item.expectedCondition)}
                      found={formatCondition(item.foundCondition)}
                    />
                  </tbody>
                </table>
                {item.notes ? (
                  <div>
                    <p className="text-xs font-medium text-slate-500">Auditor remark</p>
                    <p className="text-slate-800">{item.notes}</p>
                  </div>
                ) : null}
                {item.resolutionNotes ? (
                  <div>
                    <p className="text-xs font-medium text-slate-500">Resolution</p>
                    <p className="text-emerald-700">{item.resolutionNotes}</p>
                  </div>
                ) : null}
                <Link href={`/assets/${item.assetId}`} className="text-[hsl(var(--brand-primary))] hover:underline">
                  Open asset →
                </Link>
              </div>
            </div>

            {mode === "ticket" ? (
              <form
                action={(formData) => submit(raiseAuditTicketAction, formData)}
                className="flex flex-col gap-3 rounded-lg border bg-slate-50 p-3"
              >
                <input type="hidden" name="auditId" value={auditId} />
                <input type="hidden" name="itemId" value={item.id} />
                <p className="text-sm font-medium text-slate-900">Raise a maintenance ticket</p>
                <div className="grid gap-3 @sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="ticket-assignee">Assign to</Label>
                    <NativeSelect id="ticket-assignee" name="assignedTo" defaultValue="">
                      <option value="">Unassigned</option>
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="ticket-priority">Priority</Label>
                    <NativeSelect id="ticket-priority" name="priority" defaultValue="normal">
                      <option value="low">Low</option>
                      <option value="normal">Normal</option>
                      <option value="high">High</option>
                      <option value="emergency">Emergency</option>
                    </NativeSelect>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="ticket-note">Extra note (optional)</Label>
                  <Textarea id="ticket-note" name="note" rows={2} maxLength={1000} />
                </div>
                <p className="text-xs text-slate-500">
                  The ticket includes the problems, expected vs found and the auditor&apos;s remark.
                </p>
                <div className="flex gap-2">
                  <Button type="submit" disabled={isPending}>
                    {isPending ? "Raising..." : "Raise ticket"}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setMode("view")}>
                    Back
                  </Button>
                </div>
              </form>
            ) : null}

            {mode === "resolve" ? (
              <form
                action={(formData) => submit(resolveAuditItemAction, formData)}
                className="flex flex-col gap-3 rounded-lg border bg-slate-50 p-3"
              >
                <input type="hidden" name="auditId" value={auditId} />
                <input type="hidden" name="itemId" value={item.id} />
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="resolutionNotes">How was it resolved?</Label>
                  <Textarea id="resolutionNotes" name="resolutionNotes" required maxLength={2000} rows={3} />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={isPending}>
                    {isPending ? "Saving..." : "Mark resolved"}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setMode("view")}>
                    Back
                  </Button>
                </div>
              </form>
            ) : null}

            {mode === "view" && canEdit && !item.resolved ? (
              <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row">
                {canRaiseTicket && !item.maintenanceTicketId ? (
                  <Button type="button" onClick={() => setMode("ticket")}>
                    <Wrench className="size-4" />
                    Raise maintenance ticket
                  </Button>
                ) : null}
                {item.maintenanceTicketId ? (
                  <Button asChild variant="outline">
                    <Link href="/dashboard/administration/maintenance">
                      <Wrench className="size-4" />
                      View in Maintenance
                    </Link>
                  </Button>
                ) : null}
                <Button type="button" variant="outline" onClick={() => setMode("resolve")}>
                  <CheckCircle2 className="size-4" />
                  Resolve
                </Button>
              </div>
            ) : null}

            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
