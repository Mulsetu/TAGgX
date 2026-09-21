"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { downloadFile } from "@/lib/download";
import {
  cancelWorkspaceDeletionRequestAction,
  exportWorkspaceDataAction,
  requestWorkspaceDeletionAction,
} from "@/modules/companies/actions";
import type { CompanyBranding, DeletionRequestState } from "@/modules/companies/types";

const initialDeletionState: DeletionRequestState = { error: null };

export function DataPrivacyPanel({ company }: { company: CompanyBranding }) {
  const router = useRouter();
  const [exportError, setExportError] = useState<string | null>(null);
  const [isExporting, startExport] = useTransition();
  const [confirmSlug, setConfirmSlug] = useState("");
  const [reason, setReason] = useState("");
  const [requestState, setRequestState] = useState<DeletionRequestState>(initialDeletionState);
  const [isRequesting, startRequest] = useTransition();
  const [isCanceling, startCancel] = useTransition();

  function handleExport() {
    setExportError(null);
    startExport(async () => {
      const result = await exportWorkspaceDataAction();
      if (result.error || !result.export) {
        setExportError(result.error ?? "Could not export data.");
        return;
      }
      downloadFile(result.export.filename, result.export.content, result.export.mime, result.export.encoding);
    });
  }

  function handleRequestDeletion() {
    setRequestState(initialDeletionState);
    const formData = new FormData();
    formData.set("confirmSlug", confirmSlug);
    formData.set("reason", reason);
    startRequest(async () => {
      const result = await requestWorkspaceDeletionAction(initialDeletionState, formData);
      setRequestState(result);
      if (result.success) {
        setConfirmSlug("");
        setReason("");
        router.refresh();
      }
    });
  }

  function handleCancelRequest() {
    startCancel(async () => {
      const result = await cancelWorkspaceDeletionRequestAction();
      setRequestState(result);
      if (result.success) {
        router.refresh();
      }
    });
  }

  const canDelete = confirmSlug === company.slug;

  return (
    <div className="flex flex-col gap-4 rounded-lg border p-4">
      <div>
        <h2 className="text-sm font-semibold">Data & privacy</h2>
        <p className="text-xs text-muted-foreground">
          Export everything in your workspace, or ask us to delete it.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">Export your data</p>
        <p className="text-xs text-muted-foreground">
          Downloads a spreadsheet of your assets, locations, categories, maintenance records,
          vendors, users, and audit trail.
        </p>
        {exportError ? (
          <p role="alert" className="text-sm text-destructive">
            {exportError}
          </p>
        ) : null}
        <Button type="button" variant="outline" size="sm" className="self-start" disabled={isExporting} onClick={handleExport}>
          {isExporting ? "Preparing export..." : "Export my data"}
        </Button>
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-destructive/30 p-4">
        <p className="text-sm font-medium text-destructive">Danger zone</p>

        {company.deletionRequestedAt ? (
          <>
            <p className="text-xs text-muted-foreground">
              Deletion requested on {new Date(company.deletionRequestedAt).toLocaleDateString()}. A TagX
              team member will review and confirm with you before anything is deleted.
            </p>
            {requestState.error ? (
              <p role="alert" className="text-sm text-destructive">
                {requestState.error}
              </p>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="self-start"
              disabled={isCanceling}
              onClick={handleCancelRequest}
            >
              {isCanceling ? "Canceling..." : "Cancel deletion request"}
            </Button>
          </>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              Requests that your workspace and all of its data be permanently deleted. This does
              not delete anything immediately — TagX support reviews every request before it&apos;s
              carried out.
            </p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="destructive" size="sm" className="self-start">
                  Request deletion
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Request deletion of {company.name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Type the workspace slug <span className="font-mono font-semibold">{company.slug}</span>{" "}
                    to confirm. TagX support will reach out before anything is deleted.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="confirm-deletion-slug">Slug</Label>
                    <Input
                      id="confirm-deletion-slug"
                      value={confirmSlug}
                      onChange={(event) => setConfirmSlug(event.target.value)}
                      autoComplete="off"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="deletion-reason">Reason (optional)</Label>
                    <Textarea
                      id="deletion-reason"
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      maxLength={1000}
                      rows={3}
                    />
                  </div>
                  {requestState.error ? (
                    <p role="alert" className="text-sm text-destructive">
                      {requestState.error}
                    </p>
                  ) : null}
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isRequesting}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={(event) => {
                        // Radix closes the dialog on click by default —
                        // preventDefault keeps it open so a failed request's
                        // error (rendered above, inside this same dialog)
                        // is still visible instead of vanishing with it.
                        event.preventDefault();
                        handleRequestDeletion();
                      }}
                      disabled={!canDelete || isRequesting}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {isRequesting ? "Submitting..." : "Request deletion"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </div>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </div>
    </div>
  );
}
