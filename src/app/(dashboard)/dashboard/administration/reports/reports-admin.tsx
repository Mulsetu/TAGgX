"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { commitImportAction, exportReportAction, getImportTemplateCsv, previewImportAction } from "@/modules/reports/actions";
import { REPORT_LABELS, type ImportFormState, type ImportJobSummary, type ReportFormState, type ReportKey } from "@/modules/reports/types";

const reportState: ReportFormState = { error: null };
const importState: ImportFormState = { error: null };

function download(filename: string, content: string, mime: string, encoding?: "utf8" | "base64") {
  const bytes =
    encoding === "base64"
      ? Uint8Array.from(atob(content), (char) => char.charCodeAt(0))
      : new TextEncoder().encode(content);
  const blob = new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function ReportsAdmin({ jobs, reportKeys }: { jobs: ImportJobSummary[]; reportKeys: ReportKey[] }) {
  const [exportError, setExportError] = useState<string | null>(null);
  const [importStateLocal, setImportState] = useState<ImportFormState>(importState);
  const [isExporting, startExport] = useTransition();
  const [isImporting, startImport] = useTransition();

  function handleExport(formData: FormData) {
    startExport(async () => {
      const result = await exportReportAction(reportState, formData);
      if (result.error) {
        setExportError(result.error);
        return;
      }
      setExportError(null);
      if (result.export) {
        download(result.export.filename, result.export.content, result.export.mime, result.export.encoding);
      }
    });
  }

  function handlePreview(formData: FormData) {
    startImport(async () => {
      setImportState(await previewImportAction(importState, formData));
    });
  }

  function handleCommit(formData: FormData) {
    startImport(async () => {
      const result = await commitImportAction(importState, formData);
      setImportState(result);
      if (result.result?.errorCsv) {
        download("import-errors.csv", result.result.errorCsv, "text/csv");
      }
    });
  }

  async function downloadTemplate() {
    const csv = await getImportTemplateCsv();
    download("asset-import-template.csv", csv, "text/csv");
  }

  return (
    <div className="flex flex-col gap-8">
      <form action={handleExport} className="flex flex-wrap items-end gap-3 rounded-lg border p-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reportKey">Report</Label>
          <NativeSelect id="reportKey" name="reportKey" defaultValue={reportKeys[0] ?? "asset_register"}>
            {reportKeys.map((key) => {
              // key is the ReportKey union, not a user-controlled path.
              // eslint-disable-next-line security/detect-object-injection
              const label = REPORT_LABELS[key];
              return (
                <option key={key} value={key}>
                  {label}
                </option>
              );
            })}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="format">Format</Label>
          <NativeSelect id="format" name="format" defaultValue="csv">
            <option value="csv">CSV</option>
            <option value="xlsx">Excel</option>
          </NativeSelect>
        </div>
        <Button type="submit" disabled={isExporting}>
          {isExporting ? "Exporting..." : "Download"}
        </Button>
        {exportError ? <p className="w-full text-sm text-destructive">{exportError}</p> : null}
      </form>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">CSV import</h2>
        <p className="text-sm text-muted-foreground">
          Match category, location, and status names exactly. Download the template, then preview before committing.
        </p>
        <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => void downloadTemplate()}>
          Download template
        </Button>
        <form action={handlePreview} className="flex flex-wrap items-end gap-3">
          <Input name="file" type="file" accept=".csv,text/csv" required />
          <Button type="submit" variant="outline" disabled={isImporting}>
            Preview
          </Button>
        </form>
        <form action={handleCommit} className="flex flex-wrap items-end gap-3">
          <Input name="file" type="file" accept=".csv,text/csv" required />
          <Button type="submit" disabled={isImporting}>
            {isImporting ? "Importing..." : "Import"}
          </Button>
        </form>
        {importStateLocal.error ? <p className="text-sm text-destructive">{importStateLocal.error}</p> : null}
        {importStateLocal.result ? (
          <p className="text-sm text-muted-foreground">
            Imported {importStateLocal.result.successCount} row(s), {importStateLocal.result.errorCount} error(s).
          </p>
        ) : null}
        {importStateLocal.preview && importStateLocal.preview.length > 0 ? (
          <ul className="rounded-lg border p-3 text-sm">
            {importStateLocal.preview.map((row) => (
              <li key={row.line}>
                Line {row.line}: {row.values.name || "(no name)"}
                {row.error ? <span className="text-destructive"> — {row.error}</span> : " — ok"}
              </li>
            ))}
          </ul>
        ) : null}
        {jobs.length > 0 ? (
          <ul className="text-sm text-muted-foreground">
            {jobs.map((job) => (
              <li key={job.id}>
                {new Date(job.createdAt).toLocaleString("en-IN")} · {job.successCount} ok / {job.errorCount} errors
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
