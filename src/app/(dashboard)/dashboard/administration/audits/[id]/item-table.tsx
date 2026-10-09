"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { mediaSrc } from "@/lib/media-url";
import { Wrench } from "lucide-react";
import { markMissingAction } from "@/modules/audits/actions";
import { AUDIT_ITEM_STATUS_LABELS, auditExceptionLabel } from "@/modules/audits/types";
import type { AuditItem } from "@/modules/audits/types";
import type { AssetOption } from "@/modules/assets/types";
import { IssueDetailDialog } from "./issue-detail-dialog";

const STATUS_VARIANT: Record<AuditItem["status"], "outline" | "secondary" | "destructive"> = {
  unverified: "outline",
  verified: "secondary",
  exception: "destructive",
};

function formatCondition(value: string | null): string {
  if (!value) return "—";
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function AuditItemTable({
  auditId,
  items,
  canEdit,
  auditActive,
  requirePhotoOnException,
  users,
  canRaiseTicket,
}: {
  auditId: string;
  items: AuditItem[];
  canEdit: boolean;
  auditActive: boolean;
  requirePhotoOnException: boolean;
  users: AssetOption[];
  canRaiseTicket: boolean;
}) {
  const router = useRouter();
  const [viewing, setViewing] = useState<AuditItem | null>(null);
  const [missingItem, setMissingItem] = useState<AuditItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleMissing(itemId: string) {
    setError(null);
    if (requirePhotoOnException) {
      const item = items.find((entry) => entry.id === itemId) ?? null;
      setMissingItem(item);
      return;
    }
    startTransition(async () => {
      const result = await markMissingAction(auditId, itemId);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function handleMissingPhoto(formData: FormData) {
    if (!missingItem) {
      return;
    }
    const itemId = missingItem.id;
    startTransition(async () => {
      const result = await markMissingAction(auditId, itemId, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setMissingItem(null);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-white p-6 text-center text-sm text-muted-foreground">
          Nothing here.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {items.map((item) => {
            const movedLocation =
              item.foundLocationName && item.foundLocationName !== item.expectedLocationName;
            const changedCondition =
              item.foundCondition && item.foundCondition !== item.expectedCondition;
            return (
              <li key={item.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 gap-3">
                  {item.exceptionPhotoPath ? (
                    <button
                      type="button"
                      onClick={() => setViewing(item)}
                      className="shrink-0 overflow-hidden rounded-md border ring-primary/40 hover:ring-2"
                      aria-label={`View problem photo for ${item.assetCode}`}
                    >
                      {/* Proxied private R2 object — same-company session required. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={mediaSrc(item.exceptionPhotoPath) ?? ""}
                        alt=""
                        className="size-14 object-cover"
                      />
                    </button>
                  ) : null}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/assets/${item.assetId}`} className="font-medium text-slate-900 hover:underline">
                        {item.assetName}
                      </Link>
                      <Badge variant={STATUS_VARIANT[item.status]}>
                        {item.status === "exception" && item.resolved ? "Resolved" : AUDIT_ITEM_STATUS_LABELS[item.status]}
                      </Badge>
                      {item.maintenanceTicketId ? (
                        <Badge variant="outline" className="gap-1">
                          <Wrench className="size-3" /> Ticket raised
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-xs text-slate-500">{item.assetCode}</p>

                    {item.status === "unverified" ? (
                      <p className="mt-1 text-sm text-slate-600">Should be at {item.expectedLocationName ?? "—"}</p>
                    ) : null}

                    {item.status === "verified" ? (
                      <p className="mt-1 text-sm text-slate-600">
                        Found at {item.foundLocationName ?? item.expectedLocationName ?? "—"}
                        {item.foundCondition ? ` · ${formatCondition(item.foundCondition)}` : ""}
                      </p>
                    ) : null}

                    {item.status === "exception" ? (
                      <div className="mt-1 flex flex-col gap-0.5 text-sm">
                        {item.exceptionTypes.length > 0 ? (
                          <p className="font-medium text-red-600">
                            {item.exceptionTypes.map(auditExceptionLabel).join(", ")}
                          </p>
                        ) : null}
                        {movedLocation ? (
                          <p className="text-slate-600">
                            Found at {item.foundLocationName}, should be at {item.expectedLocationName ?? "—"}
                          </p>
                        ) : null}
                        {changedCondition ? (
                          <p className="text-slate-600">
                            Condition {formatCondition(item.foundCondition)}, expected{" "}
                            {formatCondition(item.expectedCondition)}
                          </p>
                        ) : null}
                        {item.notes ? <p className="text-slate-500">&ldquo;{item.notes}&rdquo;</p> : null}
                        {item.resolutionNotes ? (
                          <p className="text-emerald-700">Resolved: {item.resolutionNotes}</p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>

                {canEdit && auditActive && item.status === "unverified" ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11 shrink-0"
                    disabled={isPending}
                    onClick={() => handleMissing(item.id)}
                  >
                    Mark missing
                  </Button>
                ) : null}
                {item.status === "exception" ? (
                  <Button
                    type="button"
                    variant={canEdit && !item.resolved ? "default" : "outline"}
                    className="min-h-11 shrink-0"
                    onClick={() => setViewing(item)}
                  >
                    {canEdit && !item.resolved ? "Review problem" : "View details"}
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={Boolean(missingItem)} onOpenChange={(open) => !open && setMissingItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark {missingItem?.assetCode} missing</DialogTitle>
          </DialogHeader>
          {missingItem ? (
            <form action={handleMissingPhoto} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="missing-photo">Photo</Label>
                <Input id="missing-photo" name="photo" type="file" accept="image/*" required />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Saving..." : "Mark missing"}
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>

      <IssueDetailDialog
        auditId={auditId}
        item={viewing}
        users={users}
        canEdit={canEdit}
        canRaiseTicket={canRaiseTicket}
        onClose={() => setViewing(null)}
      />
    </div>
  );
}
