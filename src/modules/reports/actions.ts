"use server";

import "server-only";
import ExcelJS from "exceljs";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { assertCanCreateAsset } from "@/modules/billing/actions";
import { TENANT_HEADERS } from "@/lib/tenant";
import { requirePermission } from "@/lib/permissions/has-permission";
import { TENANT_READ_ONLY_MESSAGE, requireWritableTenant } from "@/lib/permissions/tenant-access";
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
import { getRequestAuthUser } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/audit-log";
import { createAsset, generateAssetCode } from "@/modules/assets/mutations";
import { getCategoryPrefixForAsset } from "@/modules/categories/actions";
import { buildReport, getDashboardWidgetData, lookupCatalogs } from "./queries";
import { insertImportJob } from "./mutations";
import { exportReportSchema } from "./validation";
import type {
  DashboardHomeWidget,
  ImportFormState,
  ReportFormState,
  ReportKey,
  ReportTable,
} from "./types";
import { REPORT_KEYS } from "./types";

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function tableToCsv(table: ReportTable): string {
  return [table.columns, ...table.rows].map((row) => row.map(csvEscape).join(",")).join("\n");
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

export async function getDashboardHome(): Promise<DashboardHomeWidget[]> {
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

  const data = await getDashboardWidgetData(allowed);
  return allowed
    .sort((a, b) => (configured[a].order ?? 0) - (configured[b].order ?? 0))
    .map((key) => ({
      id: key,
      label: DASHBOARD_WIDGET_LABELS[key],
      kind: DASHBOARD_WIDGET_KIND[key],
      size: configured[key].size,
      href: DASHBOARD_WIDGET_HREFS[key],
      value: data.values[key] ?? (DASHBOARD_WIDGET_KIND[key] === "stat" ? 0 : null),
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
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid report." };
  }

  const moduleKey = REPORT_MODULE_MAP[parsed.data.reportKey];
  if (moduleKey && !(await requireModule(moduleKey))) {
    return { error: "That report is not available for this company." };
  }

  const table = await buildReport(parsed.data.reportKey);
  const stamp = new Date().toISOString().slice(0, 10);
  if (parsed.data.format === "xlsx") {
    return {
      error: null,
      export: {
        filename: `${parsed.data.reportKey}-${stamp}.xlsx`,
        content: await tableToXlsxBase64(table),
        mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        encoding: "base64",
      },
    };
  }
  return {
    error: null,
    export: {
      filename: `${parsed.data.reportKey}-${stamp}.csv`,
      content: tableToCsv(table),
      mime: "text/csv;charset=utf-8",
    },
  };
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let current: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (char === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      current.push(cell.trim());
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && next === "\n") {
        i += 1;
      }
      current.push(cell.trim());
      cell = "";
      if (current.some((value) => value.length > 0)) {
        rows.push(current);
      }
      current = [];
    } else {
      cell += char;
    }
  }
  if (cell.length > 0 || current.length > 0) {
    current.push(cell.trim());
    rows.push(current);
  }
  return rows;
}

function rowToRecord(headers: string[], values: string[]): Record<string, string> {
  const record: Record<string, string> = {};
  headers.forEach((header, index) => {
    record[header] = values[index] ?? "";
  });
  return record;
}

function validateImportRow(
  record: Record<string, string>,
  catalogs: Awaited<ReturnType<typeof lookupCatalogs>>,
): string | undefined {
  if (!record.name) return "Name is required";
  if (!record.category || !catalogs.categories.get(record.category.toLowerCase())) return "Unknown category";
  if (!record.location || !catalogs.locations.get(record.location.toLowerCase())) return "Unknown location";
  if (!record.status || !catalogs.statuses.get(record.status.toLowerCase())) return "Unknown status";
  return undefined;
}

/** Add-asset CSV import. Codes always come from the category prefix, and rows stop at the plan limit. */
export async function importBasicAssetsAction(_prev: ImportFormState, formData: FormData): Promise<ImportFormState> {
  if (!(await requireWritableTenant())) {
    return { error: TENANT_READ_ONLY_MESSAGE };
  }
  if (!(await requireModule("assets")) || !(await requirePermission("assets", "create"))) {
    return { error: "You don't have permission to import assets." };
  }
  const companyId = headers().get(TENANT_HEADERS.companyId);
  const user = await getRequestAuthUser();
  if (!companyId || !user) {
    return { error: "Could not determine your company." };
  }
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a CSV file." };
  }
  if (file.size > 1_000_000) {
    return { error: "That CSV is too large." };
  }

  const parsed = parseCsv(await file.text());
  const header = parsed[0]?.map((column) => column.trim().toLowerCase());
  if (!header || ["name", "category", "location", "status"].some((column) => !header.includes(column))) {
    return { error: "The CSV needs columns for name, category, location, and status. Download the sample and use that." };
  }
  const dataRows = parsed.slice(1);
  if (dataRows.length === 0) {
    return { error: "The CSV has no asset rows." };
  }
  if (dataRows.length > 500) {
    return { error: "Import up to 500 assets at a time." };
  }

  const catalogs = await lookupCatalogs();
  const errors: string[][] = [["line", "name", "error"]];
  let successCount = 0;
  let limitMessage: string | null = null;

  for (let i = 0; i < dataRows.length; i += 1) {
    const record = rowToRecord(header, dataRows[i] ?? []);
    const line = String(i + 2);
    if (limitMessage) {
      errors.push([line, record.name ?? "", limitMessage]);
      continue;
    }
    const rowError = validateImportRow(record, catalogs);
    if (rowError) {
      errors.push([line, record.name ?? "", rowError]);
      continue;
    }
    if (record.condition && !/^[a-z][a-z0-9_]{0,63}$/.test(record.condition)) {
      errors.push([line, record.name ?? "", "Condition must be a key such as good."]);
      continue;
    }
    const quota = await assertCanCreateAsset();
    if ("error" in quota) {
      limitMessage = quota.error;
      errors.push([line, record.name ?? "", limitMessage]);
      continue;
    }
    const categoryId = catalogs.categories.get(record.category?.toLowerCase() ?? "");
    const locationId = catalogs.locations.get(record.location?.toLowerCase() ?? "");
    const status = catalogs.statuses.get(record.status?.toLowerCase() ?? "");
    if (!categoryId || !locationId || !status) {
      errors.push([line, record.name ?? "", "Lookup failed"]);
      continue;
    }
    const prefix = await getCategoryPrefixForAsset(categoryId);
    const assetCode = await generateAssetCode(companyId, prefix ?? undefined);
    const result = await createAsset({
      companyId,
      createdBy: user.id,
      assetCode,
      input: {
        name: record.name ?? "",
        categoryId,
        locationId,
        statusId: status.id,
        condition: record.condition || undefined,
        serialNumber: record.serial_number || undefined,
        brand: record.brand || undefined,
        model: record.model || undefined,
        ownershipType: "owned",
      },
      customFields: {},
    });
    if ("error" in result) {
      errors.push([line, record.name ?? "", result.error]);
      continue;
    }
    successCount += 1;
  }

  const errorCount = errors.length - 1;
  const errorCsv = errorCount > 0 ? errors.map((row) => row.map(csvEscape).join(",")).join("\n") : null;
  await insertImportJob({
    companyId,
    createdBy: user.id,
    totalRows: dataRows.length,
    successCount,
    errorCount,
    errorReport: errorCsv,
  });
  await writeAuditLog({ action: "assets.imported", entityType: "import_job", newValues: { successCount, errorCount } });
  revalidatePath("/assets");
  return { error: null, result: { successCount, errorCount, errorCsv: errorCsv ?? undefined } };
}
