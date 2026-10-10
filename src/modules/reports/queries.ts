import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { DashboardWidgetKey } from "@/lib/permissions/workspace-config";
import { listLocationAndDescendantIds } from "@/modules/locations/queries";
import type { ReportFilters, ReportKey, ReportTable } from "./types";
import { REPORT_COLUMNS } from "./types";

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

/** Asset report rows; filters run in the database, and RLS keeps them to the caller's company. */
async function listAssetRows(filters: ReportFilters): Promise<AssetReportRow[]> {
  const supabase = createClient();
  let query = supabase
    .from("assets")
    .select(
      "id, name, asset_code, condition, serial_number, brand, model, vendor, purchase_date, warranty_end_date, amc_end_date, insurance_expiry_date, location_id, allotted_to, asset_categories(name), locations(name), asset_statuses(name), allotted_user:users!assets_allotted_to_fkey(email, full_name)",
    )
    .is("deleted_at", null)
    .order("asset_code")
    .limit(5000);

  if (!filters.includeArchived) query = query.is("archived_at", null);
  if (filters.categoryId) query = query.eq("category_id", filters.categoryId);
  if (filters.locationId) query = query.in("location_id", await listLocationAndDescendantIds(filters.locationId));
  if (filters.statusId) query = query.eq("status_id", filters.statusId);
  if (filters.from) query = query.gte("purchase_date", filters.from);
  if (filters.to) query = query.lte("purchase_date", filters.to);

  const { data } = await query.returns<AssetReportRow[]>();
  return data ?? [];
}

function custodianOf(row: AssetReportRow): string {
  const user = one(row.allotted_user);
  return user?.full_name ?? user?.email ?? "";
}

function toRegister(rows: AssetReportRow[]): ReportTable {
  return {
    columns: REPORT_COLUMNS.asset_register,
    rows: rows.map((row) => [
      row.name,
      row.asset_code,
      nameOf(row.asset_categories),
      nameOf(row.locations),
      nameOf(row.asset_statuses),
      row.condition ?? "",
      custodianOf(row),
      row.brand ?? "",
      row.model ?? "",
      row.serial_number ?? "",
      row.vendor ?? "",
      row.purchase_date ?? "",
      row.warranty_end_date ?? "",
      row.amc_end_date ?? "",
      row.insurance_expiry_date ?? "",
    ]),
  };
}

function groupBy(rows: AssetReportRow[], label: string, key: (row: AssetReportRow) => string): ReportTable {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const group = key(row) || "(blank)";
    counts.set(group, (counts.get(group) ?? 0) + 1);
  }
  return {
    columns: [label, "Count"],
    rows: Array.from(counts.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([group, count]) => [group, String(count)]),
  };
}

export async function buildReport(key: ReportKey, filters: ReportFilters): Promise<ReportTable> {
  if (key === "maintenance_overdue") {
    return listOverdueMaintenance(filters);
  }
  if (key === "audit_exceptions") {
    return listAuditExceptions(filters);
  }

  const assets = await listAssetRows(filters);
  const today = new Date().toISOString().slice(0, 10);

  switch (key) {
    case "asset_register":
      return toRegister(assets);
    case "by_status":
      return groupBy(assets, "Status", (row) => nameOf(row.asset_statuses));
    case "by_location":
      return groupBy(assets, "Location", (row) => nameOf(row.locations));
    case "by_custodian":
      return groupBy(assets, "Custodian", custodianOf);
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

async function listOverdueMaintenance(filters: ReportFilters): Promise<ReportTable> {
  const supabase = createClient();
  const today = new Date().toISOString().slice(0, 10);
  const assetFiltered = Boolean(filters.categoryId || filters.locationId || filters.statusId);
  let query = supabase
    .from("maintenance_tickets")
    .select(`title, due_at, status, priority, assets${assetFiltered ? "!inner" : ""}(name, asset_code)`)
    .in("status", ["open", "in_progress"])
    .lt("due_at", today)
    .order("due_at")
    .limit(2000);

  if (filters.categoryId) query = query.eq("assets.category_id", filters.categoryId);
  if (filters.locationId) query = query.in("assets.location_id", await listLocationAndDescendantIds(filters.locationId));
  if (filters.statusId) query = query.eq("assets.status_id", filters.statusId);
  if (filters.from) query = query.gte("due_at", filters.from);
  if (filters.to) query = query.lte("due_at", `${filters.to}T23:59:59.999Z`);

  const { data } = await query.returns<
    {
      title: string;
      due_at: string | null;
      status: string;
      priority: string;
      assets: { name: string; asset_code: string } | { name: string; asset_code: string }[] | null;
    }[]
  >();
  return {
    columns: REPORT_COLUMNS.maintenance_overdue,
    rows: (data ?? []).map((row) => {
      const asset = one(row.assets);
      return [row.title, asset?.name ?? "", asset?.asset_code ?? "", row.due_at ?? "", row.status, row.priority];
    }),
  };
}

async function listAuditExceptions(filters: ReportFilters): Promise<ReportTable> {
  const supabase = createClient();
  const dated = Boolean(filters.from || filters.to);
  let query = supabase
    .from("audit_items")
    .select(`asset_name, asset_code, exception_types, notes, audits${dated ? "!inner" : ""}(name, scheduled_date)`)
    .eq("status", "exception")
    .limit(2000);

  if (filters.from) query = query.gte("audits.scheduled_date", filters.from);
  if (filters.to) query = query.lte("audits.scheduled_date", filters.to);

  const { data } = await query.returns<
    {
      asset_name: string;
      asset_code: string;
      exception_types: string[] | null;
      notes: string | null;
      audits: { name: string; scheduled_date: string } | { name: string; scheduled_date: string }[] | null;
    }[]
  >();
  return {
    columns: REPORT_COLUMNS.audit_exceptions,
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

/** Created-at window for the dashboard period filter; `until` is exclusive. */
export interface DashboardRange {
  since: string;
  until?: string;
}

/** Stat widgets that count events in a window (assets added / tickets opened). */
export const PERIOD_STAT_KEYS = [
  "total_assets",
  "active_assets",
  "missing_assets",
  "unassigned_assets",
  "assets_under_maintenance",
] as const satisfies readonly DashboardWidgetKey[];

const PERIOD_CHART_ROW_CAP = 10_000;

type NameRef = { name: string } | { name: string }[] | null;

function refName(value: NameRef, fallback: string): string {
  const row = Array.isArray(value) ? value[0] : value;
  return row?.name ?? fallback;
}

function tally(names: string[]): { name: string; value: number }[] {
  const counts = new Map<string, number>();
  for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1);
  return Array.from(counts, ([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

/**
 * Charts for assets added inside a window. The all-time charts use the
 * SQL aggregate RPCs; these group a bounded slice of rows in app code so
 * the period filter needs no new database function.
 */
async function periodCharts(range: DashboardRange, keys: Set<DashboardWidgetKey>) {
  const supabase = createClient();
  let query = supabase
    .from("assets")
    .select("asset_categories(name), locations(name), asset_statuses(name)")
    .is("deleted_at", null)
    .gte("created_at", range.since);
  if (range.until) query = query.lt("created_at", range.until);
  const { data } = await query
    .limit(PERIOD_CHART_ROW_CAP)
    .returns<{ asset_categories: NameRef; locations: NameRef; asset_statuses: NameRef }[]>();
  const rows = data ?? [];
  const charts: DashboardWidgetData["charts"] = {};
  if (keys.has("by_category")) charts.by_category = tally(rows.map((row) => refName(row.asset_categories, "Uncategorized")));
  if (keys.has("by_location")) charts.by_location = tally(rows.map((row) => refName(row.locations, "No location")));
  if (keys.has("by_status")) charts.by_status = tally(rows.map((row) => refName(row.asset_statuses, "No status")));
  return charts;
}

export async function getDashboardWidgetData(
  keys: DashboardWidgetKey[],
  range?: DashboardRange,
): Promise<DashboardWidgetData> {
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
  // Only the PERIOD_STAT_KEYS respect the window; forward-looking widgets
  // (expiries, due soon) and live-state ones (audits) stay as they are.
  const assetsQuery = () => {
    let query = supabase.from("assets").select("id", { count: "exact", head: true }).is("deleted_at", null);
    if (range) {
      query = query.gte("created_at", range.since);
      if (range.until) query = query.lt("created_at", range.until);
    }
    return query;
  };
  const values: DashboardWidgetData["values"] = {};
  const charts: DashboardWidgetData["charts"] = {};

  const jobs: Promise<void>[] = [];

  if (needed.has("total_assets")) {
    jobs.push(
      (async () => {
        values.total_assets = await count(assetsQuery());
      })(),
    );
  }
  if (needed.has("active_assets")) {
    jobs.push(
      (async () => {
        values.active_assets = await count(assetsQuery().is("archived_at", null));
      })(),
    );
  }
  if (needed.has("missing_assets")) {
    jobs.push(
      (async () => {
        values.missing_assets = await count(assetsQuery().is("location_id", null));
      })(),
    );
  }
  if (needed.has("unassigned_assets")) {
    jobs.push(
      (async () => {
        values.unassigned_assets = await count(assetsQuery().is("allotted_to", null));
      })(),
    );
  }
  if (needed.has("assets_under_maintenance")) {
    jobs.push(
      (async () => {
        let tickets = supabase
          .from("maintenance_tickets")
          .select("id", { count: "exact", head: true })
          .in("status", ["open", "in_progress"]);
        if (range) {
          tickets = tickets.gte("opened_at", range.since);
          if (range.until) tickets = tickets.lt("opened_at", range.until);
        }
        values.assets_under_maintenance = await count(tickets);
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
  const periodChartKeys = new Set(
    (["by_category", "by_status", "by_location"] as const).filter((key) => needed.has(key)),
  );
  if (range && periodChartKeys.size > 0) {
    jobs.push(
      (async () => {
        Object.assign(charts, await periodCharts(range, periodChartKeys));
      })(),
    );
    periodChartKeys.forEach((key) => needed.delete(key));
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
