"use server";

import "server-only";
import ExcelJS from "exceljs";
import { toCsv } from "@/lib/csv";
import { requirePermission } from "@/lib/permissions/has-permission";
import { getWorkspaceRuntime, requireModule } from "@/lib/permissions/features";
import { REPORT_MODULE_MAP } from "@/lib/permissions/feature-catalog";
import {
  DASHBOARD_WIDGET_HREFS,
  DASHBOARD_WIDGET_KEYS,
  DASHBOARD_WIDGET_KIND,
  DASHBOARD_WIDGET_LABELS,
  DASHBOARD_WIDGET_MODULES,
  DASHBOARD_WIDGET_PERMISSIONS,
  widgetEnabledByModules,
  type DashboardWidgetKey,
} from "@/lib/permissions/workspace-config";
import { PERIOD_STAT_KEYS, buildReport, getDashboardWidgetData, type DashboardRange } from "./queries";
import { dashboardPeriodSchema, exportReportSchema } from "./validation";
import type {
  DashboardHomeWidget,
  DashboardPeriod,
  ReportFilters,
  ReportFormState,
  ReportKey,
  ReportTable,
} from "./types";
import { REPORT_FILTERS, REPORT_KEYS } from "./types";

function tableToCsv(table: ReportTable): string {
  return toCsv([table.columns, ...table.rows]);
}

async function tableToXlsxBase64(table: ReportTable): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Report");
  sheet.addRow(table.columns);
  for (const row of table.rows) {
    sheet.addRow(row);
  }
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  return buffer.toString("base64");
}

const PERIOD_DAYS: Record<Exclude<DashboardPeriod, "all">, number> = { "7d": 7, "30d": 30, "90d": 90, "365d": 365 };

/** Current and previous windows for a period, or null for "All time". */
function periodRanges(period: DashboardPeriod): { current: DashboardRange; previous: DashboardRange } | null {
  if (period === "all") return null;
  const day = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const length = (PERIOD_DAYS[period] ?? 30) * day;
  const since = new Date(now - length).toISOString();
  return {
    current: { since },
    previous: { since: new Date(now - 2 * length).toISOString(), until: since },
  };
}

export async function getDashboardHome(rawPeriod?: unknown): Promise<DashboardHomeWidget[]> {
  const period = dashboardPeriodSchema.parse(rawPeriod);
  const ranges = periodRanges(period);
  const runtime = await getWorkspaceRuntime();
  const configured = runtime.widgets;

  const allowed: DashboardWidgetKey[] = [];
  for (const key of DASHBOARD_WIDGET_KEYS) {
    const setting = configured[key];
    if (!setting.enabled) {
      continue;
    }
    if (!widgetEnabledByModules(key, runtime.modules)) {
      continue;
    }
    const permissionModule = DASHBOARD_WIDGET_PERMISSIONS[key];
    if (permissionModule && !(await requirePermission(permissionModule, "view"))) {
      continue;
    }
    const feature = DASHBOARD_WIDGET_MODULES[key];
    if (feature && !(await requireModule(feature))) {
      continue;
    }
    allowed.push(key);
  }

  const periodStats = allowed.filter((key) => (PERIOD_STAT_KEYS as readonly string[]).includes(key));
  const [data, previous] = await Promise.all([
    getDashboardWidgetData(allowed, ranges?.current),
    ranges && periodStats.length > 0 ? getDashboardWidgetData(periodStats, ranges.previous) : Promise.resolve(null),
  ]);
  return allowed
    .sort((a, b) => (configured[a].order ?? 0) - (configured[b].order ?? 0))
    .map((key) => ({
      id: key,
      label: DASHBOARD_WIDGET_LABELS[key],
      kind: DASHBOARD_WIDGET_KIND[key],
      size: configured[key].size,
      href: DASHBOARD_WIDGET_HREFS[key],
      value: data.values[key] ?? (DASHBOARD_WIDGET_KIND[key] === "stat" ? 0 : null),
      previousValue: previous?.values[key] ?? null,
      chart: data.charts[key] ?? [],
    }));
}

export async function getAvailableReportKeys(): Promise<ReportKey[]> {
  if (!(await requireModule("reports")) || !(await requirePermission("reports", "view"))) {
    return [];
  }
  const runtime = await getWorkspaceRuntime();
  return REPORT_KEYS.filter((key) => {
    const moduleKey = REPORT_MODULE_MAP[key];
    return !moduleKey || runtime.modules[moduleKey];
  });
}

export async function exportReportAction(_prev: ReportFormState, formData: FormData): Promise<ReportFormState> {
  if (!(await requireModule("reports")) || !(await requirePermission("reports", "export"))) {
    return { error: "You don't have permission to export reports." };
  }

  const parsed = exportReportSchema.safeParse({
    reportKey: formData.get("reportKey"),
    format: formData.get("format"),
    columns: formData.getAll("columns"),
    categoryId: formData.get("categoryId"),
    locationId: formData.get("locationId"),
    statusId: formData.get("statusId"),
    from: formData.get("from"),
    to: formData.get("to"),
    includeArchived: formData.get("includeArchived") === "on",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid report." };
  }

  const { reportKey, format, columns, ...rawFilters } = parsed.data;
  const moduleKey = REPORT_MODULE_MAP[reportKey];
  if (moduleKey && !(await requireModule(moduleKey))) {
    return { error: "That report is not available for this company." };
  }

  const filters: ReportFilters = REPORT_FILTERS[reportKey].assetFilters
    ? rawFilters
    : { from: rawFilters.from, to: rawFilters.to };
  const full = await buildReport(reportKey, filters);
  const keep = full.columns.map((column, index) => (columns.includes(column) ? index : -1)).filter((index) => index >= 0);
  if (keep.length === 0) {
    return { error: "Pick at least one column." };
  }
  const table: ReportTable = {
    columns: keep.map((index) => full.columns[index] ?? ""),
    rows: full.rows.map((row) => keep.map((index) => row[index] ?? "")),
  };

  const stamp = new Date().toISOString().slice(0, 10);
  if (format === "xlsx") {
    return {
      error: null,
      rowCount: table.rows.length,
      export: {
        filename: `${reportKey}-${stamp}.xlsx`,
        content: await tableToXlsxBase64(table),
        mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        encoding: "base64",
      },
    };
  }
  return {
    error: null,
    rowCount: table.rows.length,
    export: {
      filename: `${reportKey}-${stamp}.csv`,
      content: tableToCsv(table),
      mime: "text/csv;charset=utf-8",
    },
  };
}

