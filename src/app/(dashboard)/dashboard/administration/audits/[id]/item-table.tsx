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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { mediaSrc } from "@/lib/media-url";
import { markMissingAction, resolveAuditItemAction } from "@/modules/audits/actions";
import { AUDIT_ITEM_STATUS_LABELS, auditExceptionLabel } from "@/modules/audits/types";
import type { AuditFormState, AuditItem } from "@/modules/audits/types";

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
}: {
  auditId: string;
  items: AuditItem[];
  canEdit: boolean;
  auditActive: boolean;
  requirePhotoOnException: boolean;
}) {
  const router = useRouter();
  const [resolving, setResolving] = useState<AuditItem | null>(null);
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

  function handleResolve(formData: FormData) {
    startTransition(async () => {
      const result = await resolveAuditItemAction({ error: null } satisfies AuditFormState, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setResolving(null);
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
        <p className="rounded-lg border p-4 text-center text-sm text-muted-foreground">No assets in this view.</p>
      ) : (
        <>
          <ul className="flex flex-col gap-3 md:hidden">
            {items.map((item) => (
              <li key={item.id} className="flex flex-col gap-3 rounded-xl border p-4">
                <div>
                  <Link href={`/assets/${item.assetId}`} className="font-medium hover:underline">
                    {item.assetName}
                  </Link>
                  <p className="text-xs text-muted-foreground">{item.assetCode}</p>
                </div>
                <p className="text-sm text-muted-foreground">
                  Expected: {item.expectedLocationName ?? "—"} · {formatCondition(item.expectedCondition)}
                </p>
                <p className="text-sm text-muted-foreground">
                  Found: {item.foundLocationName ?? "—"} · {formatCondition(item.foundCondition)}
                </p>
                <div>
                  <Badge variant={item.status === "exception" ? "destructive" : item.status === "verified" ? "secondary" : "outline"}>
                    {AUDIT_ITEM_STATUS_LABELS[item.status]}
                  </Badge>
                  {item.exceptionTypes.length > 0 ? (
                    <p className="mt-1 text-xs text-destructive">
                      {item.exceptionTypes.map(auditExceptionLabel).join(", ")}
                      {item.resolved ? " · resolved" : ""}
                    </p>
                  ) : null}
                  {item.notes ? <p className="mt-1 text-xs text-muted-foreground">{item.notes}</p> : null}
                  {item.exceptionPhotoPath ? (
                    // Proxied private R2 object — same-company session required.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={mediaSrc(item.exceptionPhotoPath) ?? ""}
                      alt={`Exception photo for ${item.assetCode}`}
                      className="mt-2 h-24 w-24 rounded-md border object-cover"
                    />
                  ) : null}
                  {item.resolutionNotes ? (
                    <p className="mt-1 text-xs text-muted-foreground">Resolution: {item.resolutionNotes}</p>
                  ) : null}
                </div>
                {canEdit && auditActive && item.status === "unverified" ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="touch"
                    disabled={isPending}
                    onClick={() => handleMissing(item.id)}
                  >
                    Missing
                  </Button>
                ) : null}
                {canEdit && item.status === "exception" && !item.resolved ? (
                  <Button type="button" variant="outline" size="touch" onClick={() => setResolving(item)}>
                    Resolve
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto rounded-lg border md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset</TableHead>
                  <TableHead>Expected</TableHead>
                  <TableHead>Found</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[1%]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Link href={`/assets/${item.assetId}`} className="font-medium hover:underline">
                        {item.assetName}
                      </Link>
                      <p className="text-xs text-muted-foreground">{item.assetCode}</p>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.expectedLocationName ?? "—"}
                      <p className="text-xs">{formatCondition(item.expectedCondition)}</p>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.foundLocationName ?? "—"}
                      <p className="text-xs">{formatCondition(item.foundCondition)}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.status === "exception" ? "destructive" : item.status === "verified" ? "secondary" : "outline"}>
                        {AUDIT_ITEM_STATUS_LABELS[item.status]}
                      </Badge>
                      {item.exceptionTypes.length > 0 ? (
                        <p className="mt-1 text-xs text-destructive">
                          {item.exceptionTypes.map(auditExceptionLabel).join(", ")}
                          {item.resolved ? " · resolved" : ""}
                        </p>
                      ) : null}
                      {item.notes ? <p className="mt-1 text-xs text-muted-foreground">{item.notes}</p> : null}
                      {item.exceptionPhotoPath ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={mediaSrc(item.exceptionPhotoPath) ?? ""}
                          alt={`Exception photo for ${item.assetCode}`}
                          className="mt-2 h-16 w-16 rounded-md border object-cover"
                        />
                      ) : null}
                      {item.resolutionNotes ? (
                        <p className="mt-1 text-xs text-muted-foreground">Resolution: {item.resolutionNotes}</p>
                      ) : null}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {canEdit && auditActive && item.status === "unverified" ? (
                        <Button
                          type="button"
                          variant="outline"
                          className="min-h-11"
                          disabled={isPending}
                          onClick={() => handleMissing(item.id)}
                        >
                          Missing
                        </Button>
                      ) : null}
                      {canEdit && item.status === "exception" && !item.resolved ? (
                        <Button type="button" variant="outline" className="min-h-11" onClick={() => setResolving(item)}>
                          Resolve
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
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

      <Dialog open={Boolean(resolving)} onOpenChange={(open) => !open && setResolving(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve {resolving?.assetCode}</DialogTitle>
          </DialogHeader>
          {resolving ? (
            <form action={handleResolve} className="flex flex-col gap-3">
              <input type="hidden" name="auditId" value={auditId} />
              <input type="hidden" name="itemId" value={resolving.id} />
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="resolutionNotes">Resolution notes</Label>
                <Textarea id="resolutionNotes" name="resolutionNotes" required maxLength={2000} rows={3} />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Saving..." : "Mark resolved"}
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
