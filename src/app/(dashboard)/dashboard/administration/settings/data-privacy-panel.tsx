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
import { Download, Trash2 } from "lucide-react";
import { LocalTime } from "@/components/layout/local-time";
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
    <div className="grid max-w-4xl gap-4 @3xl:grid-cols-2">
      <section className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500">
            <Download className="size-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Export your data</h2>
            <p className="text-sm text-slate-500">
              One Excel workbook with everything in this workspace — assets, locations, categories,
              maintenance, vendors, people and the activity trail. Use it as a backup or to move to
              another system.
            </p>
          </div>
        </div>
        {exportError ? (
          <p role="alert" className="text-sm text-destructive">
            {exportError}
          </p>
        ) : null}
        <Button type="button" variant="outline" className="mt-auto self-start" disabled={isExporting} onClick={handleExport}>
          <Download className="size-4" />
          {isExporting ? "Preparing export..." : "Download workbook"}
        </Button>
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-red-200 bg-white p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-red-50 text-red-600">
            <Trash2 className="size-4" />
          </span>
          <h2 className="pt-1.5 text-sm font-semibold text-red-700">Delete workspace</h2>
        </div>

        {company.deletionRequestedAt ? (
          <>
            <p className="text-sm text-slate-600">
              Deletion requested on <LocalTime iso={company.deletionRequestedAt} mode="date" />. A TagX
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
            <p className="text-sm text-slate-600">
              Ask TagX to permanently delete this workspace and all of its data. Nothing is deleted
              right away — our team reviews every request and confirms with you first. Export your
              data before you ask.
            </p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="destructive" className="mt-auto self-start">
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
      </section>
    </div>
  );
}
