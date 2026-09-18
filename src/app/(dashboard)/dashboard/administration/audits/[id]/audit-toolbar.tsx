"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { completeAuditAction, deleteAuditAction, exportAuditResultsAction, startAuditAction } from "@/modules/audits/actions";
import type { AuditDetail } from "@/modules/audits/types";

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

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {canEdit && audit.status === "draft" ? (
          <Button type="button" onClick={() => run(() => startAuditAction(audit.id))} disabled={isPending}>
            Start audit
          </Button>
        ) : null}
        {canEdit && audit.status === "active" ? (
          <Button
            type="button"
            disabled={isPending}
            onClick={() => {
              const confirmed = window.confirm(
                audit.unverifiedCount > 0
                  ? `${audit.unverifiedCount} unverified asset(s) will be flagged as missing. Complete this audit?`
                  : "Mark this audit as completed?",
              );
              if (!confirmed) return;
              run(() => completeAuditAction(audit.id));
            }}
          >
            Complete audit
          </Button>
        ) : null}
        <Button type="button" variant="outline" onClick={handleExport} disabled={isPending}>
          Export CSV
        </Button>
        {canDelete && audit.status === "draft" ? (
          <Button
            type="button"
            variant="destructive"
            disabled={isPending}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const result = await deleteAuditAction(audit.id);
                if (result.error) {
                  setError(result.error);
                  return;
                }
                router.push("/dashboard/administration/audits");
              });
            }}
          >
            Delete draft
          </Button>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
