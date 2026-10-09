"use client";

import { useState, useTransition } from "react";
import { Download, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadFile as download } from "@/lib/download";
import { exportReportAction } from "@/modules/reports/actions";
import { REPORT_LABELS, type ReportFormState, type ReportKey } from "@/modules/reports/types";

const reportState: ReportFormState = { error: null };

const REPORT_DESCRIPTIONS: Record<ReportKey, string> = {
  asset_register: "Every asset with code, category, location, status, condition, custodian, serial and warranty/AMC/insurance end dates.",
  by_status: "How many assets are in each status.",
  by_location: "How many assets sit at each location.",
  by_custodian: "How many assets each person holds.",
  missing_unassigned: "Assets with no location or no custodian — the gaps to clean up.",
  maintenance_overdue: "Open maintenance tickets that are past their due date.",
  warranty_amc: "Assets whose warranty, AMC or insurance is still running, with end dates — to plan renewals.",
  audit_exceptions: "Every problem found across all audits, with the auditor's notes.",
};

/** One card per report; each downloads the full, company-wide data as CSV or Excel. */
export function ReportsAdmin({ reportKeys }: { reportKeys: ReportKey[] }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [, startExport] = useTransition();

  function exportReport(reportKey: ReportKey, format: "csv" | "xlsx") {
    setError(null);
    setPending(`${reportKey}:${format}`);
    const formData = new FormData();
    formData.set("reportKey", reportKey);
    formData.set("format", format);
    startExport(async () => {
      const result = await exportReportAction(reportState, formData);
      setPending(null);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.export) {
        download(result.export.filename, result.export.content, result.export.mime, result.export.encoding);
      }
    });
  }

  if (reportKeys.length === 0) {
    return (
      <p className="rounded-xl border border-dashed bg-white p-8 text-center text-sm text-muted-foreground">
        No reports are available for the modules turned on in this workspace.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <ul className="grid grid-cols-1 gap-3 @2xl:grid-cols-2 @5xl:grid-cols-3">
        {reportKeys.map((key) => (
          <li key={key} className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500">
                <FileSpreadsheet className="size-4" />
              </span>
              <div className="min-w-0">
                {/* key is the ReportKey union, not a user-controlled path. */}
                {/* eslint-disable-next-line security/detect-object-injection */}
                <p className="font-medium text-slate-900">{REPORT_LABELS[key]}</p>
                {/* eslint-disable-next-line security/detect-object-injection */}
                <p className="text-sm text-slate-500">{REPORT_DESCRIPTIONS[key]}</p>
              </div>
            </div>
            <div className="mt-auto flex gap-2">
              {(["csv", "xlsx"] as const).map((format) => (
                <Button
                  key={format}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  disabled={pending !== null}
                  onClick={() => exportReport(key, format)}
                >
                  <Download className="size-4" />
                  {pending === `${key}:${format}` ? "Preparing..." : format === "csv" ? "CSV" : "Excel"}
                </Button>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
