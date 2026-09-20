import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { DashboardWidgetKey } from "@/lib/permissions/workspace-config";
import type { ImportJobSummary, ReportKey, ReportTable } from "./types";

interface AssetReportRow {
  id: string;
  name: string;
  asset_code: string;
  condition: string | null;
  serial_number: string | null;
  brand: string | null;
  model: string | null;
  vendor: string | null;
  purchase_date: string | null;
  warranty_end_date: string | null;
  amc_end_date: string | null;
  insurance_expiry_date: string | null;
  location_id: string | null;
  allotted_to: string | null;
  asset_categories: { name: string } | { name: string }[] | null;
  locations: { name: string } | { name: string }[] | null;
  asset_statuses: { name: string } | { name: string }[] | null;
  allotted_user: { email: string; full_name: string | null } | { email: string; full_name: string | null }[] | null;
}

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function nameOf(value: { name: string } | { name: string }[] | null): string {
  return one(value)?.name ?? "";
}

async function listAssetRows(): Promise<AssetReportRow[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("assets")
    .select(
      "id, name, asset_code, condition, serial_number, brand, model, vendor, purchase_date, warranty_end_date, amc_end_date, insurance_expiry_date, location_id, allotted_to, asset_categories(name), locations(name), asset_statuses(name), allotted_user:users!assets_allotted_to_fkey(email, full_name)",
    )
    .order("asset_code")
    .limit(5000)
    .returns<AssetReportRow[]>();
  return data ?? [];
}

function toRegister(rows: AssetReportRow[]): ReportTable {
  return {
    columns: [
      "Name",
      "Code",
      "Category",
      "Location",
      "Status",
      "Condition",
      "Custodian",
      "Serial",
      "Warranty end",
      "AMC end",
      "Insurance end",
    ],
    rows: rows.map((row) => [
      row.name,
      row.asset_code,
      nameOf(row.asset_categories),
      nameOf(row.locations),
      nameOf(row.asset_statuses),
      row.condition ?? "",
      one(row.allotted_user)?.full_name ?? one(row.allotted_user)?.email ?? "",
      row.serial_number ?? "",
      row.warranty_end_date ?? "",
      row.amc_end_date ?? "",
      row.insurance_expiry_date ?? "",
    ]),
  };
}

function groupBy(rows: AssetReportRow[], key: (row: AssetReportRow) => string): ReportTable {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const label = key(row) || "(blank)";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return {
    columns: ["Group", "Count"],
    rows: Array.from(counts.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([group, count]) => [group, String(count)]),
  };
}

export async function buildReport(key: ReportKey): Promise<ReportTable> {
  if (key === "maintenance_overdue") {
    return listOverdueMaintenance();
  }
  if (key === "audit_exceptions") {
    return listAuditExceptions();
  }

  const assets = await listAssetRows();
  const today = new Date().toISOString().slice(0, 10);

  switch (key) {
    case "asset_register":
      return toRegister(assets);
    case "by_status":
      return groupBy(assets, (row) => nameOf(row.asset_statuses));
    case "by_location":
      return groupBy(assets, (row) => nameOf(row.locations));
    case "by_custodian":
      return groupBy(assets, (row) => one(row.allotted_user)?.full_name ?? one(row.allotted_user)?.email ?? "");
    case "missing_unassigned":
      return toRegister(assets.filter((row) => !row.location_id || !row.allotted_to));
    case "warranty_amc":
      return toRegister(
        assets.filter(
          (row) =>
            (row.warranty_end_date && row.warranty_end_date >= today) ||
            (row.amc_end_date && row.amc_end_date >= today) ||
            (row.insurance_expiry_date && row.insurance_expiry_date >= today),
        ),
      );
    default:
      return { columns: [], rows: [] };
  }
}

async function listOverdueMaintenance(): Promise<ReportTable> {
  const supabase = createClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("maintenance_tickets")
    .select("title, due_at, status, priority, assets(name, asset_code)")
    .in("status", ["open", "in_progress"])
    .lt("due_at", today)
    .limit(2000)
    .returns<
      {
        title: string;
        due_at: string | null;
        status: string;
        priority: string;
        assets: { name: string; asset_code: string } | { name: string; asset_code: string }[] | null;
      }[]
    >();
  return {
    columns: ["Title", "Asset", "Code", "Due", "Status", "Priority"],
    rows: (data ?? []).map((row) => {
      const asset = one(row.assets);
      return [row.title, asset?.name ?? "", asset?.asset_code ?? "", row.due_at ?? "", row.status, row.priority];
    }),
  };
}

async function listAuditExceptions(): Promise<ReportTable> {
  const supabase = createClient();
  const { data } = await supabase
    .from("audit_items")
    .select("asset_name, asset_code, exception_types, notes, audits(name, scheduled_date)")
    .eq("status", "exception")
    .limit(2000)
    .returns<
      {
        asset_name: string;
        asset_code: string;
        exception_types: string[] | null;
        notes: string | null;
        audits: { name: string; scheduled_date: string } | { name: string; scheduled_date: string }[] | null;
      }[]
    >();
  return {
    columns: ["Audit", "Date", "Asset", "Code", "Exceptions", "Notes"],
    rows: (data ?? []).map((row) => {
      const audit = one(row.audits);
      return [
        audit?.name ?? "",
        audit?.scheduled_date ?? "",
        row.asset_name,
        row.asset_code,
        (row.exception_types ?? []).join("; "),
        row.notes ?? "",
      ];
    }),
  };
}

export interface DashboardWidgetData {
  values: Partial<Record<DashboardWidgetKey, number>>;
  charts: Partial<Record<DashboardWidgetKey, { name: string; value: number }[]>>;
}

export async function getDashboardWidgetData(keys: DashboardWidgetKey[]): Promise<DashboardWidgetData> {
  const needed = new Set(keys);
  if (needed.size === 0) {
    return { values: {}, charts: {} };
  }

  const supabase = createClient();
  const today = new Date().toISOString().slice(0, 10);
  const soon = new Date();
  soon.setUTCDate(soon.getUTCDate() + 30);
  const soonDate = soon.toISOString().slice(0, 10);

  const count = async (query: PromiseLike<{ count: number | null }>) => (await query).count ?? 0;
  const values: DashboardWidgetData["values"] = {};
  const charts: DashboardWidgetData["charts"] = {};

  const jobs: Promise<void>[] = [];

  if (needed.has("total_assets")) {
    jobs.push(
      (async () => {
        values.total_assets = await count(
          supabase.from("assets").select("id", { count: "exact", head: true }).is("deleted_at", null),
        );
      })(),
    );
  }
  if (needed.has("active_assets")) {
    jobs.push(
      (async () => {
        values.active_assets = await count(
          supabase
            .from("assets")
            .select("id", { count: "exact", head: true })
            .is("deleted_at", null)
            .is("archived_at", null),
        );
      })(),
    );
  }
  if (needed.has("missing_assets")) {
    jobs.push(
      (async () => {
        values.missing_assets = await count(
          supabase
            .from("assets")
            .select("id", { count: "exact", head: true })
            .is("location_id", null)
            .is("deleted_at", null),
        );
      })(),
    );
  }
  if (needed.has("unassigned_assets")) {
    jobs.push(
      (async () => {
        values.unassigned_assets = await count(
          supabase
            .from("assets")
            .select("id", { count: "exact", head: true })
            .is("allotted_to", null)
            .is("deleted_at", null),
        );
      })(),
    );
  }
  if (needed.has("assets_under_maintenance")) {
    jobs.push(
      (async () => {
        values.assets_under_maintenance = await count(
          supabase
            .from("maintenance_tickets")
            .select("id", { count: "exact", head: true })
            .in("status", ["open", "in_progress"]),
        );
      })(),
    );
  }
  if (needed.has("maintenance_due")) {
    jobs.push(
      (async () => {
        values.maintenance_due = await count(
          supabase
            .from("maintenance_tickets")
            .select("id", { count: "exact", head: true })
            .in("status", ["open", "in_progress"])
            .lt("due_at", today),
        );
      })(),
    );
  }
  if (needed.has("upcoming_maintenance")) {
    jobs.push(
      (async () => {
        values.upcoming_maintenance = await count(
          supabase
            .from("maintenance_tickets")
            .select("id", { count: "exact", head: true })
            .in("status", ["open", "in_progress"])
            .gte("due_at", today)
            .lte("due_at", soonDate),
        );
      })(),
    );
  }
  if (needed.has("warranty_expiry")) {
    jobs.push(
      (async () => {
        values.warranty_expiry = await count(
          supabase
            .from("assets")
            .select("id", { count: "exact", head: true })
            .gte("warranty_end_date", today)
            .lte("warranty_end_date", soonDate),
        );
      })(),
    );
  }
  if (needed.has("amc_expiry")) {
    jobs.push(
      (async () => {
        values.amc_expiry = await count(
          supabase
            .from("assets")
            .select("id", { count: "exact", head: true })
            .gte("amc_end_date", today)
            .lte("amc_end_date", soonDate),
        );
      })(),
    );
  }
  if (needed.has("insurance_expiry")) {
    jobs.push(
      (async () => {
        values.insurance_expiry = await count(
          supabase
            .from("assets")
            .select("id", { count: "exact", head: true })
            .gte("insurance_expiry_date", today)
            .lte("insurance_expiry_date", soonDate),
        );
      })(),
    );
  }
  if (needed.has("document_expiry")) {
    jobs.push(
      (async () => {
        values.document_expiry = await count(
          supabase
            .from("asset_documents")
            .select("id", { count: "exact", head: true })
            .gte("expires_at", today)
            .lte("expires_at", soonDate),
        );
      })(),
    );
  }
  if (needed.has("audit_progress")) {
    jobs.push(
      (async () => {
        values.audit_progress = await count(
          supabase.from("audits").select("id", { count: "exact", head: true }).eq("status", "active"),
        );
      })(),
    );
  }
  if (needed.has("pending_audits")) {
    jobs.push(
      (async () => {
        values.pending_audits = await count(
          supabase.from("audits").select("id", { count: "exact", head: true }).eq("status", "draft"),
        );
      })(),
    );
  }
  if (needed.has("open_exceptions")) {
    jobs.push(
      (async () => {
        values.open_exceptions = await count(
          supabase.from("audit_items").select("id", { count: "exact", head: true }).eq("status", "exception"),
        );
      })(),
    );
  }
  if (needed.has("missing_from_audit")) {
    jobs.push(
      (async () => {
        values.missing_from_audit = await count(
          supabase.from("audit_items").select("id", { count: "exact", head: true }).eq("status", "unverified"),
        );
      })(),
    );
  }
  if (needed.has("pending_approvals")) {
    jobs.push(
      (async () => {
        values.pending_approvals = await count(
          supabase.from("asset_transfers").select("id", { count: "exact", head: true }).eq("status", "pending"),
        );
      })(),
    );
  }
  if (needed.has("vendor_summary")) {
    jobs.push(
      (async () => {
        values.vendor_summary = await count(supabase.from("vendors").select("id", { count: "exact", head: true }));
      })(),
    );
  }
  if (needed.has("storage_usage")) {
    jobs.push(
      (async () => {
        const { data } = await supabase
          .from("company_settings")
          .select("storage_used_bytes, storage_limit_bytes")
          .maybeSingle<{ storage_used_bytes: number; storage_limit_bytes: number }>();
        const used = data?.storage_used_bytes ?? 0;
        const limit = data?.storage_limit_bytes ?? 0;
        values.storage_usage = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
      })(),
    );
  }
  if (needed.has("by_category")) {
    jobs.push(
      (async () => {
        const { data } = await supabase.rpc("get_asset_counts_by_category");
        charts.by_category = ((data as { category_name: string; count: string }[] | null) ?? []).map((row) => ({
          name: row.category_name,
          value: Number(row.count),
        }));
      })(),
    );
  }
  if (needed.has("by_status")) {
    jobs.push(
      (async () => {
        const { data } = await supabase.rpc("get_asset_counts_by_status");
        charts.by_status = ((data as { status_name: string; count: string }[] | null) ?? []).map((row) => ({
          name: row.status_name,
          value: Number(row.count),
        }));
      })(),
    );
  }
  if (needed.has("by_location")) {
    jobs.push(
      (async () => {
        const { data } = await supabase.rpc("get_asset_counts_by_location");
        charts.by_location = ((data as { location_name: string; count: string }[] | null) ?? []).map((row) => ({
          name: row.location_name,
          value: Number(row.count),
        }));
      })(),
    );
  }
  if (needed.has("open_tickets")) {
    jobs.push(
      (async () => {
        const open = await count(
          supabase
            .from("maintenance_tickets")
            .select("id", { count: "exact", head: true })
            .in("status", ["open", "in_progress"]),
        );
        values.open_tickets = open;
        charts.open_tickets = [{ name: "Open", value: open }];
      })(),
    );
  }

  await Promise.all(jobs);
  return { values, charts };
}

export async function listImportJobs(): Promise<ImportJobSummary[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("import_jobs")
    .select("id, status, total_rows, success_count, error_count, error_report, created_at")
    .order("created_at", { ascending: false })
    .limit(20)
    .returns<
      {
        id: string;
        status: string;
        total_rows: number;
        success_count: number;
        error_count: number;
        error_report: string | null;
        created_at: string;
      }[]
    >();
  return (data ?? []).map((row) => ({
    id: row.id,
    status: row.status,
    totalRows: row.total_rows,
    successCount: row.success_count,
    errorCount: row.error_count,
    errorReport: row.error_report,
    createdAt: row.created_at,
  }));
}

export async function lookupCatalogs(): Promise<{
  categories: Map<string, string>;
  locations: Map<string, string>;
  statuses: Map<string, { id: string; isFinal: boolean }>;
}> {
  const supabase = createClient();
  const [{ data: categories }, { data: locations }, { data: statuses }] = await Promise.all([
    supabase.from("asset_categories").select("id, name").returns<{ id: string; name: string }[]>(),
    supabase.from("locations").select("id, name").returns<{ id: string; name: string }[]>(),
    supabase.from("asset_statuses").select("id, name, is_final").returns<{ id: string; name: string; is_final: boolean }[]>(),
  ]);
  return {
    categories: new Map((categories ?? []).map((row) => [row.name.trim().toLowerCase(), row.id])),
    locations: new Map((locations ?? []).map((row) => [row.name.trim().toLowerCase(), row.id])),
    statuses: new Map(
      (statuses ?? []).map((row) => [row.name.trim().toLowerCase(), { id: row.id, isFinal: row.is_final }]),
    ),
  };
}
