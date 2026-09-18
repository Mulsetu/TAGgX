import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { AssetCondition } from "@/modules/assets/types";
import { listLocationOptions } from "@/modules/locations/queries";
import { AUDIT_ITEM_STATUSES, AUDIT_STATUSES } from "./types";
import type {
  AuditDetail,
  AuditExceptionType,
  AuditItem,
  AuditItemFilters,
  AuditItemListResult,
  AuditItemStatus,
  AuditListItem,
  AuditListResult,
  AuditLocationOption,
  AuditStatus,
  AuditTagContext,
} from "./types";

const PAGE_SIZE = 25;
const FETCH_PAGE = 1000;

interface AuditRow {
  id: string;
  name: string;
  scheduled_date: string;
  location_id: string | null;
  location_name: string | null;
  status: string;
  created_by: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  require_photo_on_exception?: boolean;
  require_remark_on_exception?: boolean;
}

interface AuditItemRow {
  id: string;
  audit_id: string;
  asset_id: string;
  asset_name: string;
  asset_code: string;
  expected_location_id: string | null;
  expected_location_name: string | null;
  expected_condition: string | null;
  status: string;
  exception_types: string[] | null;
  found_location_id: string | null;
  found_location_name: string | null;
  found_condition: string | null;
  notes: string | null;
  scanned_at: string | null;
  resolved: boolean;
  resolution_notes: string | null;
  exception_photo_path: string | null;
}

function isAuditStatus(value: string): value is AuditStatus {
  return (AUDIT_STATUSES as readonly string[]).includes(value);
}

function isItemStatus(value: string): value is AuditItemStatus {
  return (AUDIT_ITEM_STATUSES as readonly string[]).includes(value);
}

function isExceptionType(value: string): value is AuditExceptionType {
  return /^[a-z][a-z0-9_]{0,63}$/.test(value);
}

function isCondition(value: string | null): AssetCondition | null {
  if (!value || !/^[a-z][a-z0-9_]{0,63}$/.test(value)) {
    return null;
  }
  return value;
}

function parseExceptionTypes(value: string[] | null): AuditExceptionType[] {
  return (value ?? []).filter(isExceptionType);
}

function progressFromCounts(total: number, verified: number, exceptions: number): {
  totalItems: number;
  verifiedCount: number;
  exceptionCount: number;
  unverifiedCount: number;
  progressPercent: number;
} {
  const totalItems = total;
  const verifiedCount = verified;
  const exceptionCount = exceptions;
  const unverifiedCount = Math.max(0, totalItems - verifiedCount - exceptionCount);
  const progressPercent = totalItems === 0 ? 0 : Math.round(((verifiedCount + exceptionCount) / totalItems) * 100);
  return { totalItems, verifiedCount, exceptionCount, unverifiedCount, progressPercent };
}

async function countItems(
  auditId: string,
  extra?: { column: string; value: string | boolean },
): Promise<number> {
  const supabase = createClient();
  let query = supabase.from("audit_items").select("id", { count: "exact", head: true }).eq("audit_id", auditId);
  if (extra) {
    query = query.eq(extra.column, extra.value);
  }
  const { count, error } = await query;
  if (error) {
    return 0;
  }
  return count ?? 0;
}

async function countsForAudit(auditId: string): Promise<ReturnType<typeof progressFromCounts>> {
  const [total, verified, exceptions] = await Promise.all([
    countItems(auditId),
    countItems(auditId, { column: "status", value: "verified" }),
    countItems(auditId, { column: "status", value: "exception" }),
  ]);
  return progressFromCounts(total, verified, exceptions);
}

async function unresolvedExceptionCount(auditId: string): Promise<number> {
  const supabase = createClient();
  const { count, error } = await supabase
    .from("audit_items")
    .select("id", { count: "exact", head: true })
    .eq("audit_id", auditId)
    .eq("status", "exception")
    .eq("resolved", false);

  if (error) {
    return 0;
  }
  return count ?? 0;
}

function rowToItem(row: AuditItemRow): AuditItem | null {
  if (!isItemStatus(row.status)) {
    return null;
  }
  return {
    id: row.id,
    assetId: row.asset_id,
    assetName: row.asset_name,
    assetCode: row.asset_code,
    expectedLocationId: row.expected_location_id,
    expectedLocationName: row.expected_location_name,
    expectedCondition: isCondition(row.expected_condition),
    status: row.status,
    exceptionTypes: parseExceptionTypes(row.exception_types),
    foundLocationId: row.found_location_id,
    foundLocationName: row.found_location_name,
    foundCondition: isCondition(row.found_condition),
    notes: row.notes,
    scannedAt: row.scanned_at,
    resolved: row.resolved,
    resolutionNotes: row.resolution_notes,
    exceptionPhotoPath: row.exception_photo_path,
  };
}

const ITEM_SELECT = `
  id, audit_id, asset_id, asset_name, asset_code,
  expected_location_id, expected_location_name, expected_condition,
  status, exception_types, found_location_id, found_location_name, found_condition,
  notes, scanned_at, resolved, resolution_notes, exception_photo_path
`;

export async function listAudits(
  page: number,
  pageSize = PAGE_SIZE,
  status?: AuditStatus,
): Promise<AuditListResult> {
  const supabase = createClient();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("audits")
    .select("id, name, scheduled_date, location_id, location_name, status, created_by, started_at, completed_at, created_at", {
      count: "exact",
    })
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error, count } = await query.range(from, to).returns<AuditRow[]>();

  if (error || !data) {
    return { items: [], totalCount: 0, page, pageSize };
  }

  const items: AuditListItem[] = [];
  for (const row of data) {
    if (!isAuditStatus(row.status)) {
      continue;
    }
    const counts = await countsForAudit(row.id);
    items.push({
      id: row.id,
      name: row.name,
      scheduledDate: row.scheduled_date,
      locationName: row.location_name,
      status: row.status,
      createdAt: row.created_at,
      ...counts,
    });
  }

  return { items, totalCount: count ?? items.length, page, pageSize };
}

export async function getAuditById(id: string): Promise<AuditDetail | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("audits")
    .select("id, name, scheduled_date, location_id, location_name, status, created_by, started_at, completed_at, created_at, require_photo_on_exception, require_remark_on_exception")
    .eq("id", id)
    .maybeSingle<AuditRow>();

  if (error || !data || !isAuditStatus(data.status)) {
    return null;
  }

  const [counts, unresolved, creator] = await Promise.all([
    countsForAudit(data.id),
    unresolvedExceptionCount(data.id),
    data.created_by
      ? supabase
          .from("users")
          .select("full_name, email")
          .eq("id", data.created_by)
          .maybeSingle<{ full_name: string | null; email: string }>()
      : Promise.resolve({ data: null as { full_name: string | null; email: string } | null }),
  ]);

  return {
    id: data.id,
    name: data.name,
    scheduledDate: data.scheduled_date,
    locationId: data.location_id,
    locationName: data.location_name,
    status: data.status,
    createdByName: creator.data?.full_name ?? creator.data?.email ?? null,
    startedAt: data.started_at,
    completedAt: data.completed_at,
    createdAt: data.created_at,
    unresolvedExceptionCount: unresolved,
    requirePhotoOnException: data.require_photo_on_exception === true,
    requireRemarkOnException: data.require_remark_on_exception === true,
    ...counts,
  };
}

export async function listAuditItems(
  auditId: string,
  filters: AuditItemFilters,
  page: number,
  pageSize = PAGE_SIZE,
): Promise<AuditItemListResult> {
  const supabase = createClient();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("audit_items")
    .select(ITEM_SELECT, { count: "exact" })
    .eq("audit_id", auditId);

  if (filters.tab === "unverified") {
    query = query.eq("status", "unverified");
  } else if (filters.tab === "verified") {
    query = query.eq("status", "verified");
  } else if (filters.tab === "exceptions") {
    query = query.eq("status", "exception");
  }
  if (filters.exceptionType) {
    query = query.contains("exception_types", [filters.exceptionType]);
  }

  const { data, error, count } = await query.order("asset_code").range(from, to).returns<AuditItemRow[]>();
  if (error || !data) {
    return { items: [], totalCount: 0, page, pageSize };
  }

  return {
    items: data.map(rowToItem).filter((item): item is AuditItem => item !== null),
    totalCount: count ?? data.length,
    page,
    pageSize,
  };
}

export async function listAllAuditItems(auditId: string): Promise<AuditItem[]> {
  const supabase = createClient();
  const rows: AuditItemRow[] = [];
  let from = 0;

  for (;;) {
    const { data, error } = await supabase
      .from("audit_items")
      .select(ITEM_SELECT)
      .eq("audit_id", auditId)
      .order("asset_code")
      .range(from, from + FETCH_PAGE - 1)
      .returns<AuditItemRow[]>();

    if (error || !data) {
      break;
    }
    rows.push(...data);
    if (data.length < FETCH_PAGE) {
      break;
    }
    from += FETCH_PAGE;
  }

  return rows.map(rowToItem).filter((item): item is AuditItem => item !== null);
}

export async function findAuditItemByScan(
  auditId: string,
  ref: { assetId: string | null; assetCode: string | null },
): Promise<AuditItem | null> {
  const supabase = createClient();

  if (ref.assetId) {
    const { data } = await supabase
      .from("audit_items")
      .select(ITEM_SELECT)
      .eq("audit_id", auditId)
      .eq("asset_id", ref.assetId)
      .maybeSingle<AuditItemRow>();
    return data ? rowToItem(data) : null;
  }

  if (!ref.assetCode) {
    return null;
  }

  const { data } = await supabase
    .from("audit_items")
    .select(ITEM_SELECT)
    .eq("audit_id", auditId)
    .eq("asset_code", ref.assetCode)
    .maybeSingle<AuditItemRow>();

  return data ? rowToItem(data) : null;
}

export async function findActiveAuditItemForAsset(assetId: string): Promise<AuditTagContext | null> {
  const supabase = createClient();

  const { data: campaigns, error: campaignError } = await supabase
    .from("audits")
    .select("id, name")
    .eq("status", "active")
    .returns<{ id: string; name: string }[]>();

  if (campaignError || !campaigns || campaigns.length === 0) {
    return null;
  }

  const { data, error } = await supabase
    .from("audit_items")
    .select(ITEM_SELECT)
    .eq("asset_id", assetId)
    .in(
      "audit_id",
      campaigns.map((campaign) => campaign.id),
    )
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<AuditItemRow>();

  if (error || !data) {
    return null;
  }

  const item = rowToItem(data);
  if (!item) {
    return null;
  }

  const campaign = campaigns.find((entry) => entry.id === data.audit_id);
  if (!campaign) {
    return null;
  }

  const locations = await listAuditLocations();
  const [conditions, exceptionTypes] = await Promise.all([listAuditConditionOptions(), listAuditExceptionTypeOptions()]);
  return { auditId: campaign.id, auditName: campaign.name, item, locations, conditions, exceptionTypes };
}

export async function listAuditLocations(): Promise<AuditLocationOption[]> {
  const items = await listLocationOptions();
  return items.map((item) => ({ id: item.id, name: item.name }));
}

export interface AssetSnapshot {
  id: string;
  name: string;
  assetCode: string;
  locationId: string | null;
  locationName: string | null;
  condition: string | null;
}

interface AssetScopeRow {
  id: string;
  name: string;
  asset_code: string;
  location_id: string | null;
  condition: string | null;
  location: { name: string } | null;
}

export async function listAssetsForAuditScope(locationId: string | null): Promise<AssetSnapshot[]> {
  const supabase = createClient();
  const snapshots: AssetSnapshot[] = [];
  let from = 0;

  for (;;) {
    let query = supabase
      .from("assets")
      .select("id, name, asset_code, location_id, condition, location:locations(name)")
      .order("asset_code");

    if (locationId) {
      query = query.eq("location_id", locationId);
    }

    const { data, error } = await query.range(from, from + FETCH_PAGE - 1).returns<AssetScopeRow[]>();
    if (error || !data) {
      break;
    }

    for (const row of data) {
      snapshots.push({
        id: row.id,
        name: row.name,
        assetCode: row.asset_code,
        locationId: row.location_id,
        locationName: row.location?.name ?? null,
        condition: row.condition,
      });
    }

    if (data.length < FETCH_PAGE) {
      break;
    }
    from += FETCH_PAGE;
  }

  return snapshots;
}

export async function getLocationName(id: string): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase.from("locations").select("name").eq("id", id).maybeSingle<{ name: string }>();
  return data?.name ?? null;
}

export async function listAuditConditionOptions(): Promise<{ key: string; name: string }[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("asset_conditions")
    .select("key, name")
    .eq("is_active", true)
    .order("sort_order")
    .returns<{ key: string; name: string }[]>();
  return data ?? [];
}

export async function listAuditExceptionTypeOptions(): Promise<{ key: string; name: string }[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("audit_exception_types")
    .select("key, name")
    .eq("is_active", true)
    .order("sort_order")
    .returns<{ key: string; name: string }[]>();
  return data ?? [];
}
