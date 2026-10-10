"use client";

import { useState, useTransition } from "react";
import { Download, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { downloadFile as download } from "@/lib/download";
import { cn } from "@/lib/utils";
import { exportReportAction } from "@/modules/reports/actions";
import {
  REPORT_COLUMNS,
  REPORT_DESCRIPTIONS,
  REPORT_FILTERS,
  REPORT_LABELS,
  type ReportFormState,
  type ReportKey,
} from "@/modules/reports/types";

interface FilterOption {
  id: string;
  name: string;
}

const reportState: ReportFormState = { error: null };

/**
 * One report builder instead of a card per report: pick the report, narrow
 * it with filters, choose the columns, then download CSV or Excel.
 */
export function ReportsAdmin({
  reportKeys,
  categories,
  locations,
  statuses,
}: {
  reportKeys: ReportKey[];
  categories: FilterOption[];
  locations: FilterOption[];
  statuses: FilterOption[];
}) {
  const [reportKey, setReportKey] = useState<ReportKey | null>(reportKeys[0] ?? null);
  const [columns, setColumns] = useState<Set<string>>(
    () => new Set(reportKeys[0] ? REPORT_COLUMNS[reportKeys[0]] : []),
  );
  const [format, setFormat] = useState<"csv" | "xlsx">("xlsx");
  const [message, setMessage] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  const [isPending, startExport] = useTransition();

  if (!reportKey) {
    return (
      <p className="rounded-xl border border-dashed bg-white p-8 text-center text-sm text-muted-foreground">
        No reports are available for the modules turned on in this workspace.
      </p>
    );
  }

  const available = REPORT_COLUMNS[reportKey];
  const filterSpec = REPORT_FILTERS[reportKey];
  const showAssetFilters = filterSpec.assetFilters && (categories.length > 0 || locations.length > 0 || statuses.length > 0);

  function chooseReport(key: ReportKey) {
    setReportKey(key);
    setColumns(new Set(REPORT_COLUMNS[key]));
    setMessage(null);
  }

  function toggleColumn(column: string) {
    setColumns((current) => {
      const next = new Set(current);
      if (next.has(column)) next.delete(column);
      else next.add(column);
      return next;
    });
  }

  function handleExport(formData: FormData) {
    if (!reportKey) return;
    formData.set("reportKey", reportKey);
    formData.set("format", format);
    formData.delete("columns");
    for (const column of available) {
      if (columns.has(column)) formData.append("columns", column);
    }
    setMessage(null);
    startExport(async () => {
      const result = await exportReportAction(reportState, formData);
      if (result.error) {
        setMessage({ tone: "error", text: result.error });
        return;
      }
      if (result.export) {
        download(result.export.filename, result.export.content, result.export.mime, result.export.encoding);
        const rows = result.rowCount ?? 0;
        setMessage({ tone: "info", text: `Downloaded ${rows.toLocaleString("en-IN")} row${rows === 1 ? "" : "s"}.` });
      }
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <div className="lg:hidden">
        <Label htmlFor="report-key">Report</Label>
        <NativeSelect
          id="report-key"
          className="mt-1.5"
          value={reportKey}
          onChange={(event) => chooseReport(event.target.value as ReportKey)}
        >
          {reportKeys.map((key) => (
            <option key={key} value={key}>
              {REPORT_LABELS[key]}
            </option>
          ))}
        </NativeSelect>
      </div>
      <nav className="hidden flex-col gap-1 rounded-xl border border-slate-200 bg-white p-2 lg:flex" aria-label="Reports">
        <p className="px-2 pb-1 pt-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Reports</p>
        {reportKeys.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => chooseReport(key)}
            className={cn(
              "flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm",
              key === reportKey ? "bg-primary/10 font-medium text-slate-900" : "text-slate-600 hover:bg-slate-50",
            )}
          >
            <FileSpreadsheet className="size-4 shrink-0 text-slate-400" />
            <span className="truncate">{REPORT_LABELS[key]}</span>
          </button>
        ))}
      </nav>

      <form
        key={reportKey}
        action={handleExport}
        className="flex min-w-0 flex-col gap-5 rounded-xl border border-slate-200 bg-white p-4 sm:p-5"
      >
        <div>
          <h2 className="text-base font-semibold text-slate-900">{REPORT_LABELS[reportKey]}</h2>
          <p className="text-sm text-slate-500">{REPORT_DESCRIPTIONS[reportKey]}</p>
        </div>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Filters</legend>
          {showAssetFilters ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <FilterSelect id="report-category" name="categoryId" label="Category" allLabel="All categories" options={categories} />
              <FilterSelect id="report-location" name="locationId" label="Location" allLabel="All locations" options={locations} />
              <FilterSelect id="report-status" name="statusId" label="Status" allLabel="All statuses" options={statuses} />
            </div>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="report-from">{filterSpec.dateLabel} from</Label>
              <Input id="report-from" name="from" type="date" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="report-to">{filterSpec.dateLabel} to</Label>
              <Input id="report-to" name="to" type="date" />
            </div>
          </div>
          {filterSpec.assetFilters && reportKey !== "maintenance_overdue" ? (
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" name="includeArchived" className="size-4 rounded border-slate-300" />
              Include archived assets
            </label>
          ) : null}
        </fieldset>

        <fieldset>
          <div className="mb-2 flex items-center justify-between gap-2">
            <legend className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Columns ({columns.size} of {available.length})
            </legend>
            <span className="flex gap-3 text-xs">
              <button type="button" className="text-[hsl(var(--brand-primary))] hover:underline" onClick={() => setColumns(new Set(available))}>
                Select all
              </button>
              <button type="button" className="text-slate-500 hover:underline" onClick={() => setColumns(new Set())}>
                Clear
              </button>
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {available.map((column) => (
              <label
                key={column}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-2 text-sm",
                  columns.has(column)
                    ? "border-[hsl(var(--brand-primary)/0.4)] bg-[hsl(var(--brand-primary)/0.05)] text-slate-800"
                    : "border-slate-200 text-slate-500",
                )}
              >
                <input
                  type="checkbox"
                  className="size-4 rounded border-slate-300"
                  checked={columns.has(column)}
                  onChange={() => toggleColumn(column)}
                />
                {column}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
          <div className="inline-flex rounded-lg border border-slate-200 p-0.5" role="radiogroup" aria-label="Format">
            {(["xlsx", "csv"] as const).map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={format === option}
                onClick={() => setFormat(option)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium",
                  format === option ? "bg-primary text-primary-foreground" : "text-slate-600 hover:bg-slate-50",
                )}
              >
                {option === "xlsx" ? "Excel" : "CSV"}
              </button>
            ))}
          </div>
          <Button type="submit" disabled={isPending || columns.size === 0}>
            <Download className="size-4" />
            {isPending ? "Preparing..." : "Download report"}
          </Button>
          {message ? (
            <p
              role={message.tone === "error" ? "alert" : "status"}
              className={cn("text-sm", message.tone === "error" ? "text-destructive" : "text-slate-600")}
            >
              {message.text}
            </p>
          ) : null}
        </div>
      </form>
    </div>
  );
}

function FilterSelect({
  id,
  name,
  label,
  allLabel,
  options,
}: {
  id: string;
  name: string;
  label: string;
  allLabel: string;
  options: FilterOption[];
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <NativeSelect id={id} name={name} defaultValue="">
        <option value="">{allLabel}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}
