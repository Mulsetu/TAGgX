"use server";

import "server-only";
import ExcelJS from "exceljs";
import { headers } from "next/headers";
import { TENANT_HEADERS } from "@/lib/tenant";
import { requirePermission } from "@/lib/permissions/has-permission";
import { TENANT_READ_ONLY_MESSAGE, requireWritableTenant } from "@/lib/permissions/tenant-access";
import { getWorkspaceRuntime, requireModule } from "@/lib/permissions/features";
import { REPORT_MODULE_MAP } from "@/lib/permissions/feature-catalog";
import {
  DASHBOARD_WIDGET_MODULES,
  type DashboardWidgetKey,
} from "@/lib/permissions/workspace-config";
import { getRequestAuthUser } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/audit-log";
import { createAsset, generateAssetCode } from "@/modules/assets/mutations";
import { getCategoryPrefixForAsset } from "@/modules/categories/actions";
import { buildReport, getDashboardTiles, listImportJobs, lookupCatalogs } from "./queries";
import { insertImportJob } from "./mutations";
import { IMPORT_COLUMNS, exportReportSchema } from "./validation";
import type {
  DashboardTile,
  ImportFormState,
  ImportJobSummary,
  ImportPreviewRow,
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

export async function getDashboardTilesForHome(): Promise<DashboardTile[]> {
  if (!(await requirePermission("assets", "view"))) {
    return [];
  }
  const [tiles, runtime] = await Promise.all([getDashboardTiles(), getWorkspaceRuntime()]);
  return tiles
    .filter((tile) => {
      const key = tile.id as DashboardWidgetKey;
      const widget = runtime.widgets[key];
      if (widget && !widget.enabled) {
        return false;
      }
      const moduleKey = DASHBOARD_WIDGET_MODULES[key];
      if (moduleKey && !runtime.modules[moduleKey]) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      const orderA = runtime.widgets[a.id as DashboardWidgetKey]?.order ?? 0;
      const orderB = runtime.widgets[b.id as DashboardWidgetKey]?.order ?? 0;
      return orderA - orderB;
    });
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

export async function getImportJobsForAdmin(): Promise<ImportJobSummary[]> {
  if (!(await requireModule("reports")) || !(await requirePermission("reports", "view"))) {
    return [];
  }
  return listImportJobs();
}

export async function getImportTemplateCsv(): Promise<string> {
  if (!(await requireModule("reports")) || !(await requirePermission("reports", "view"))) {
    return "";
  }
  return IMPORT_COLUMNS.join(",");
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

export async function previewImportAction(_prev: ImportFormState, formData: FormData): Promise<ImportFormState> {
  if (!(await requireWritableTenant())) {
    return { error: TENANT_READ_ONLY_MESSAGE };
  }
  if (!(await requireModule("reports")) || !(await requirePermission("assets", "create"))) {
    return { error: "You don't have permission to import assets." };
  }
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { error: "Choose a CSV file." };
  }
  const text = await file.text();
  const parsed = parseCsv(text);
  const header = parsed[0];
  if (!header || header[0] !== "name") {
    return { error: "CSV must start with a header row beginning with name." };
  }
  const catalogs = await lookupCatalogs();
  const preview: ImportPreviewRow[] = parsed.slice(1, 21).map((values, index) => {
    const record = rowToRecord(header, values);
    return { line: index + 2, values: record, error: validateImportRow(record, catalogs) };
  });
  return { error: null, preview };
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

export async function commitImportAction(_prev: ImportFormState, formData: FormData): Promise<ImportFormState> {
  if (!(await requireWritableTenant())) {
    return { error: TENANT_READ_ONLY_MESSAGE };
  }
  if (!(await requireModule("reports")) || !(await requirePermission("assets", "create"))) {
    return { error: "You don't have permission to import assets." };
  }
  const companyId = headers().get(TENANT_HEADERS.companyId);
  const user = await getRequestAuthUser();
  if (!companyId || !user) {
    return { error: "Could not determine your company." };
  }
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { error: "Choose a CSV file." };
  }

  const parsed = parseCsv(await file.text());
  const header = parsed[0];
  if (!header) {
    return { error: "Empty CSV." };
  }
  const catalogs = await lookupCatalogs();
  const errors: string[][] = [["line", "name", "error"]];
  let successCount = 0;

  for (let i = 1; i < parsed.length; i += 1) {
    const record = rowToRecord(header, parsed[i] ?? []);
    const rowError = validateImportRow(record, catalogs);
    if (rowError) {
      errors.push([String(i + 1), record.name ?? "", rowError]);
      continue;
    }
    const categoryName = record.category?.toLowerCase() ?? "";
    const locationName = record.location?.toLowerCase() ?? "";
    const statusName = record.status?.toLowerCase() ?? "";
    const categoryId = catalogs.categories.get(categoryName);
    const locationId = catalogs.locations.get(locationName);
    const status = catalogs.statuses.get(statusName);
    if (!categoryId || !locationId || !status) {
      errors.push([String(i + 1), record.name ?? "", "Lookup failed"]);
      continue;
    }
    const prefix = await getCategoryPrefixForAsset(categoryId);
    const assetCode = record.asset_code || (await generateAssetCode(companyId, prefix ?? undefined));
    const name = record.name;
    if (!name) {
      errors.push([String(i + 1), "", "Name is required"]);
      continue;
    }
    const result = await createAsset({
      companyId,
      createdBy: user.id,
      assetCode,
      input: {
        name,
        categoryId,
        locationId,
        statusId: status.id,
        condition: record.condition || undefined,
        serialNumber: record.serial_number || undefined,
        brand: record.brand || undefined,
        model: record.model || undefined,
        vendor: record.vendor || undefined,
        purchaseDate: record.purchase_date || undefined,
        purchasePrice: record.purchase_price ? Number(record.purchase_price) : undefined,
        warrantyEndDate: record.warranty_end_date || undefined,
        amcEndDate: record.amc_end_date || undefined,
        insuranceExpiryDate: record.insurance_expiry_date || undefined,
        ownershipType: "owned",
      },
      customFields: {},
    });
    if ("error" in result) {
      errors.push([String(i + 1), record.name ?? "", result.error]);
      continue;
    }
    successCount += 1;
  }

  const errorCount = errors.length - 1;
  const errorCsv = errorCount > 0 ? errors.map((row) => row.map(csvEscape).join(",")).join("\n") : null;
  await insertImportJob({
    companyId,
    createdBy: user.id,
    totalRows: parsed.length - 1,
    successCount,
    errorCount,
    errorReport: errorCsv,
  });
  await writeAuditLog({ action: "assets.imported", entityType: "import_job", newValues: { successCount, errorCount } });
  return { error: null, result: { successCount, errorCount, errorCsv: errorCsv ?? undefined } };
}
