"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Download, Play, ScanLine, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { completeAuditAction, deleteAuditAction, exportAuditResultsAction, startAuditAction } from "@/modules/audits/actions";
import type { AuditDetail } from "@/modules/audits/types";

/**
 * "What to do next" card: one sentence for the current status plus the
 * single primary action for it. Export / delete stay as secondary buttons.
 */
export function AuditToolbar({
  audit,
  canEdit,
  canDelete,
}: {
  audit: AuditDetail;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function run(action: () => Promise<{ error: string | null }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function handleExport() {
    setError(null);
    startTransition(async () => {
      const result = await exportAuditResultsAction(audit.id);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = result.filename;
      link.click();
      URL.revokeObjectURL(url);
    });
  }

  function handleComplete() {
    const confirmed = window.confirm(
      audit.unverifiedCount > 0
        ? `${audit.unverifiedCount} asset(s) were not scanned and will be marked missing. Complete this audit?`
        : "Mark this audit as completed?",
    );
    if (confirmed) {
      run(() => completeAuditAction(audit.id));
    }
  }

  function handleDelete() {
    if (!window.confirm("Delete this draft audit?")) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteAuditAction(audit.id);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.push("/dashboard/administration/audits");
    });
  }

  let message: string;
  if (audit.status === "draft") {
    message = canEdit
      ? `Ready to begin. Start the audit to scan its ${audit.totalItems} asset(s).`
      : "This audit hasn't been started yet.";
  } else if (audit.status === "active") {
    message =
      audit.unverifiedCount > 0
        ? `Scanning in progress — ${audit.unverifiedCount} asset(s) still to scan.`
        : "Every asset has been scanned. Complete the audit to close it.";
  } else {
    message =
      audit.unresolvedExceptionCount > 0
        ? `Audit finished. ${audit.unresolvedExceptionCount} problem(s) still need to be resolved below.`
        : "Audit finished. Nothing left to do — export the results if you need a copy.";
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">What to do next</p>
        <p className="text-sm text-slate-900">{message}</p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {canEdit && audit.status === "draft" ? (
          <Button type="button" onClick={() => run(() => startAuditAction(audit.id))} disabled={isPending}>
            <Play className="size-4" />
            {isPending ? "Starting..." : "Start audit"}
          </Button>
        ) : null}
        {canEdit && audit.status === "active" ? (
          <>
            <Button asChild variant={audit.unverifiedCount > 0 ? "default" : "outline"}>
              <Link href={`/floor/audits/${audit.id}`}>
                <ScanLine className="size-4" />
                Open scanner
              </Link>
            </Button>
            <Button
              type="button"
              variant={audit.unverifiedCount > 0 ? "outline" : "default"}
              disabled={isPending}
              onClick={handleComplete}
            >
              <CheckCircle2 className="size-4" />
              Complete audit
            </Button>
          </>
        ) : null}
        <Button type="button" variant="ghost" onClick={handleExport} disabled={isPending}>
          <Download className="size-4" />
          Export CSV
        </Button>
        {canDelete && audit.status === "draft" ? (
          <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" disabled={isPending} onClick={handleDelete}>
            <Trash2 className="size-4" />
            Delete draft
          </Button>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </section>
  );
}
