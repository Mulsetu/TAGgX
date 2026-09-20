import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildR2PublicUrl } from "@/lib/r2/client";
import { parseAssetFieldConfig } from "@/lib/permissions/workspace-config";
import type {
  Asset,
  AssetAttachment,
  AssetCondition,
  AssetFormOptions,
  AssetListFilters,
  AssetListItem,
  AssetListResult,
  AssetLocationMove,
  AssetCriticality,
  AssetOption,
  CategoryAssetCount,
  DocumentExpiryStatus,
  LocationAssetCount,
  OwnershipType,
  PublicAsset,
  StatusAssetCount,
  UpcomingWarrantyReminder,
  WarrantyReminderReason,
} from "./types";
import { ASSET_CRITICALITIES } from "./types";
import { formatCustomFieldValue } from "@/modules/categories/validation";
import { listCategoryFieldsAdmin, listRequiredDocumentsByCategory } from "@/modules/categories/queries";
import { listLocationAndDescendantIds, listLocationOptions, listLocations } from "@/modules/locations/queries";
import type { CustomFieldValue } from "@/modules/categories/types";

// Postgres bigint comes back from PostgREST as a JSON string (to avoid
// precision loss), not a number — hence `count: string` here.
interface CategoryCountRow {
  category_id: string | null;
  category_name: string;
  count: string;
}

interface StatusCountRow {
  status_id: string;
  status_name: string;
  count: string;
}

/**
 * Asset counts grouped by category, for the dashboard chart. Calls the
 * `get_asset_counts_by_category` RPC (see
 * supabase/migrations/0016_dashboard_aggregates.sql), which aggregates in
 * SQL rather than pulling every asset row over the wire. It's
 * `security invoker`, so the existing `assets_tenant_isolation` RLS policy
 * already scopes this to the caller's own company.
 */
export async function getAssetCountsByCategory(): Promise<CategoryAssetCount[]> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc("get_asset_counts_by_category");

  if (error || !data) {
    return [];
  }

  // Without a generated Database type, .rpc()'s return type isn't known
  // statically — this cast is what actually pins it down to the RPC's
  // real shape (see supabase/migrations/0016_dashboard_aggregates.sql).
  return (data as CategoryCountRow[]).map((row) => ({
    categoryId: row.category_id,
    categoryName: row.category_name,
    count: Number(row.count),
  }));
}

interface LocationCountRow {
  location_id: string | null;
  location_name: string;
  count: string;
}

/** Asset counts grouped by location, for the dashboard chart. */
export async function getAssetCountsByLocation(): Promise<LocationAssetCount[]> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc("get_asset_counts_by_location");

  if (error || !data) {
    return [];
  }

  return (data as LocationCountRow[]).map((row) => ({
    locationId: row.location_id,
    locationName: row.location_name,
    count: Number(row.count),
  }));
}

/** Asset counts grouped by status, for the dashboard chart. */
export async function getAssetCountsByStatus(): Promise<StatusAssetCount[]> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc("get_asset_counts_by_status");

  if (error || !data) {
    return [];
  }

  return (data as StatusCountRow[]).map((row) => ({
    statusId: row.status_id,
    statusName: row.status_name,
    count: Number(row.count),
  }));
}

interface AssetListRow {
  id: string;
  name: string;
  asset_code: string;
  status_id: string;
  image_url: string | null;
  location_id: string | null;
  serial_number: string | null;
  condition: string | null;
  vendor: string | null;
  vendor_id: string | null;
  allotted_to: string | null;
  category: { name: string } | null;
  location: { name: string } | null;
  status: { name: string } | null;
  vendor_row: { name: string } | null;
}

function escapeIlike(raw: string): string {
  return raw.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_").replace(/,/g, " ");
}

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function isoPlusDays(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

const SORT_COLUMN = {
  created: "created_at",
  name: "name",
  code: "asset_code",
  purchase: "purchase_date",
} as const;

/**
 * Server-paginated, filterable asset list for /assets. RLS
 * (`assets_tenant_isolation`) scopes this to the caller's own company —
 * no explicit company_id filter needed here.
 */
export async function listAssets(
  filters: AssetListFilters,
  page: number,
  pageSize: number,
): Promise<AssetListResult> {
  const supabase = createClient();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const today = isoToday();
  const sortColumn = SORT_COLUMN[filters.sort ?? "created"];
  const ascending = filters.sortDir === "asc";

  let query = supabase
    .from("assets")
    .select(
      "id, name, asset_code, status_id, image_url, location_id, serial_number, condition, vendor, vendor_id, allotted_to, category:asset_categories(name), location:locations(name), status:asset_statuses(name), vendor_row:vendors(name)",
      { count: "exact" },
    )
    .is("deleted_at", null)
    .order(sortColumn, { ascending, nullsFirst: false })
    .range(from, to);

  if (!filters.includeArchived) {
    query = query.is("archived_at", null);
  }
  if (filters.categoryId) {
    query = query.eq("category_id", filters.categoryId);
  }
  if (filters.locationId) {
    const locationIds = await listLocationAndDescendantIds(filters.locationId);
    query = query.in("location_id", locationIds);
  }
  if (filters.statusId) {
    query = query.eq("status_id", filters.statusId);
  }
  if (filters.vendorId) {
    query = query.eq("vendor_id", filters.vendorId);
  }
  if (filters.allottedTo) {
    query = query.eq("allotted_to", filters.allottedTo);
  }
  if (filters.condition) {
    query = query.eq("condition", filters.condition);
  }
  if (filters.warranty === "active") {
    query = query.gte("warranty_end_date", today);
  } else if (filters.warranty === "expired") {
    query = query.lt("warranty_end_date", today);
  } else if (filters.warranty === "none") {
    query = query.is("warranty_end_date", null);
  }
  if (filters.amc === "active") {
    query = query.gte("amc_end_date", today);
  } else if (filters.amc === "expired") {
    query = query.lt("amc_end_date", today);
  } else if (filters.amc === "none") {
    query = query.is("amc_end_date", null);
  }
  if (filters.documentExpiry) {
    const ids = await listAssetIdsByDocumentExpiry(filters.documentExpiry);
    if (ids.length === 0) {
      return { items: [], totalCount: 0, page, pageSize };
    }
    query = query.in("id", ids);
  }

  const search = filters.q?.trim();
  if (search) {
    const pattern = `%${escapeIlike(search)}%`;
    const orParts = [
      `name.ilike.${pattern}`,
      `asset_code.ilike.${pattern}`,
      `serial_number.ilike.${pattern}`,
      `vendor.ilike.${pattern}`,
      `department.ilike.${pattern}`,
    ];

    const [{ data: locationHits }, { data: userHits }] = await Promise.all([
      supabase.from("locations").select("id").ilike("name", pattern).limit(50).returns<{ id: string }[]>(),
      supabase
        .from("users")
        .select("id")
        .or(`full_name.ilike.${pattern},email.ilike.${pattern}`)
        .limit(50)
        .returns<{ id: string }[]>(),
    ]);
    const locationIds = (locationHits ?? []).map((row) => row.id);
    if (locationIds.length > 0) {
      orParts.push(`location_id.in.(${locationIds.join(",")})`);
    }
    const userIds = (userHits ?? []).map((row) => row.id);
    if (userIds.length > 0) {
      orParts.push(`allotted_to.in.(${userIds.join(",")})`);
    }
    query = query.or(orParts.join(","));
  }

  const { data, error, count } = await query.returns<AssetListRow[]>();

  if (error || !data) {
    return { items: [], totalCount: 0, page, pageSize };
  }

  const pathById = new Map((await listLocations()).map((location) => [location.id, location.path]));
  const custodianIds = Array.from(
    new Set(data.map((row) => row.allotted_to).filter((id): id is string => Boolean(id))),
  );
  const custodianNames = new Map<string, string>();
  if (custodianIds.length > 0) {
    const { data: custodians } = await supabase
      .from("users")
      .select("id, full_name, email")
      .in("id", custodianIds)
      .returns<{ id: string; full_name: string | null; email: string }[]>();
    for (const row of custodians ?? []) {
      custodianNames.set(row.id, row.full_name ?? row.email);
    }
  }

  const items: AssetListItem[] = data.map((row) => ({
    id: row.id,
    name: row.name,
    assetCode: row.asset_code,
    categoryName: row.category?.name ?? null,
    locationName: (row.location_id ? pathById.get(row.location_id) : null) ?? row.location?.name ?? null,
    statusId: row.status_id,
    statusName: row.status?.name ?? "—",
    imageUrl: row.image_url,
    serialNumber: row.serial_number,
    vendorName: row.vendor_row?.name ?? row.vendor,
    allottedToName: row.allotted_to ? (custodianNames.get(row.allotted_to) ?? null) : null,
    condition: row.condition,
  }));

  return { items, totalCount: count ?? items.length, page, pageSize };
}

async function listAssetIdsByDocumentExpiry(
  kind: "expired" | "expiring" | "none",
): Promise<string[]> {
  const supabase = createClient();
  const today = isoToday();
  let docs = supabase.from("asset_documents").select("asset_id").not("expires_at", "is", null);
  if (kind === "expired") {
    docs = docs.lt("expires_at", today);
  } else if (kind === "expiring") {
    docs = docs.gte("expires_at", today).lte("expires_at", isoPlusDays(30));
  } else {
    const { data } = await supabase
      .from("asset_documents")
      .select("asset_id")
      .not("expires_at", "is", null)
      .returns<{ asset_id: string }[]>();
    const withExpiry = new Set((data ?? []).map((row) => row.asset_id));
    const { data: assets } = await supabase
      .from("assets")
      .select("id")
      .is("deleted_at", null)
      .limit(5000)
      .returns<{ id: string }[]>();
    return (assets ?? []).map((row) => row.id).filter((id) => !withExpiry.has(id));
  }
  const { data } = await docs.returns<{ asset_id: string }[]>();
  return Array.from(new Set((data ?? []).map((row) => row.asset_id)));
}

interface AssetDetailRow {
  id: string;
  company_id: string;
  name: string;
  image_url: string | null;
  asset_code: string;
  category_id: string | null;
  location_id: string | null;
  cwip_invoice_id: string | null;
  status_id: string;
  condition: AssetCondition | null;
  brand: string | null;
  model: string | null;
  linked_asset_id: string | null;
  description: string | null;
  serial_number: string | null;
  vendor: string | null;
  vendor_id: string | null;
  po_number: string | null;
  invoice_date: string | null;
  invoice_number: string | null;
  purchase_date: string | null;
  purchase_price: number | null;
  ownership_type: OwnershipType;
  partner_name: string | null;
  allotted_to: string | null;
  allotment_date: string | null;
  warranty_start_date: string | null;
  warranty_end_date: string | null;
  amc_provider: string | null;
  amc_start_date: string | null;
  amc_end_date: string | null;
  insurance_provider: string | null;
  insurance_policy_number: string | null;
  insurance_expiry_date: string | null;
  criticality: string | null;
  useful_life_years: number | null;
  current_book_value: number | null;
  residual_value: number | null;
  notes: string | null;
  department: string | null;
  tags: string[] | null;
  archived_at: string | null;
  deleted_at: string | null;
  parent_asset_id: string | null;
  created_at: string;
  updated_at: string;
  qr_generated_at: string | null;
  custom_fields: unknown;
  category: { name: string } | null;
  location: { name: string } | null;
  status: { name: string } | null;
}

const ASSET_DETAIL_SELECT = `
  id, company_id, name, image_url, asset_code, category_id, location_id, cwip_invoice_id, status_id,
  condition, brand, model, linked_asset_id, description, serial_number,
  vendor, vendor_id, po_number, invoice_date, invoice_number, purchase_date, purchase_price,
  ownership_type, partner_name, allotted_to, allotment_date,
  warranty_start_date, warranty_end_date, amc_provider, amc_start_date, amc_end_date,
  insurance_provider, insurance_policy_number, insurance_expiry_date,
  criticality, useful_life_years, current_book_value, residual_value, notes, department, tags,
  archived_at, deleted_at, parent_asset_id,
  created_at, updated_at, qr_generated_at, custom_fields,
  category:asset_categories(name),
  location:locations(name),
  status:asset_statuses(name)
`;

function asCriticality(value: string | null): AssetCriticality | null {
  if (!value || !(ASSET_CRITICALITIES as readonly string[]).includes(value)) {
    return null;
  }
  return value as AssetCriticality;
}

function asCustomFields(value: unknown): Record<string, CustomFieldValue> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const out: Record<string, CustomFieldValue> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string" || typeof entry === "number" || typeof entry === "boolean") {
      out[key] = entry;
    }
  }
  return out;
}

function rowToAsset(
  data: AssetDetailRow,
  related: {
    linkedAssetName: string | null;
    allottedToName: string | null;
    locationPath: string | null;
    parentAssetName: string | null;
  },
): Asset {
  return {
    id: data.id,
    companyId: data.company_id,
    name: data.name,
    imageUrl: data.image_url,
    assetCode: data.asset_code,
    categoryId: data.category_id,
    categoryName: data.category?.name ?? null,
    locationId: data.location_id,
    locationName: related.locationPath ?? data.location?.name ?? null,
    cwipInvoiceId: data.cwip_invoice_id,
    statusId: data.status_id,
    statusName: data.status?.name ?? "—",
    condition: data.condition,
    brand: data.brand,
    model: data.model,
    linkedAssetId: data.linked_asset_id,
    linkedAssetName: related.linkedAssetName,
    description: data.description,
    serialNumber: data.serial_number,
    vendor: data.vendor,
    vendorId: data.vendor_id,
    poNumber: data.po_number,
    invoiceDate: data.invoice_date,
    invoiceNumber: data.invoice_number,
    purchaseDate: data.purchase_date,
    purchasePrice: data.purchase_price,
    ownershipType: data.ownership_type,
    partnerName: data.partner_name,
    allottedTo: data.allotted_to,
    allottedToName: related.allottedToName,
    allotmentDate: data.allotment_date,
    warrantyStartDate: data.warranty_start_date,
    warrantyEndDate: data.warranty_end_date,
    amcProvider: data.amc_provider,
    amcStartDate: data.amc_start_date,
    amcEndDate: data.amc_end_date,
    insuranceProvider: data.insurance_provider,
    insurancePolicyNumber: data.insurance_policy_number,
    insuranceExpiryDate: data.insurance_expiry_date,
    criticality: asCriticality(data.criticality),
    usefulLifeYears: data.useful_life_years,
    currentBookValue: data.current_book_value,
    residualValue: data.residual_value,
    notes: data.notes,
    department: data.department,
    tags: data.tags ?? [],
    archivedAt: data.archived_at,
    deletedAt: data.deleted_at,
    parentAssetId: data.parent_asset_id,
    parentAssetName: related.parentAssetName,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    qrGeneratedAt: data.qr_generated_at,
    customFields: asCustomFields(data.custom_fields),
  };
}

/** Full detail row for /assets/[id] and the edit form. */
export async function getAssetById(id: string): Promise<Asset | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("assets")
    .select(ASSET_DETAIL_SELECT)
    .eq("id", id)
    .maybeSingle<AssetDetailRow>();

  if (error || !data) {
    return null;
  }

  // Linked-asset / allotted-user are fetched separately: embedding a
  // self-join (`assets!assets_linked_asset_id_fkey`) plus a second FK to
  // `users` (created_by vs allotted_to) inside the same `.maybeSingle()`
  // made PostgREST reject the whole row, so the list was clickable but
  // the detail page 404'd.
  const [linkedRes, allottedRes, parentRes, locations] = await Promise.all([
    data.linked_asset_id
      ? supabase.from("assets").select("name").eq("id", data.linked_asset_id).maybeSingle<{ name: string }>()
      : Promise.resolve({ data: null as { name: string } | null }),
    data.allotted_to
      ? supabase
          .from("users")
          .select("full_name, email")
          .eq("id", data.allotted_to)
          .maybeSingle<{ full_name: string | null; email: string }>()
      : Promise.resolve({ data: null as { full_name: string | null; email: string } | null }),
    data.parent_asset_id
      ? supabase.from("assets").select("name").eq("id", data.parent_asset_id).maybeSingle<{ name: string }>()
      : Promise.resolve({ data: null as { name: string } | null }),
    listLocations(),
  ]);

  return rowToAsset(data, {
    linkedAssetName: linkedRes.data?.name ?? null,
    allottedToName: allottedRes.data?.full_name ?? allottedRes.data?.email ?? null,
    locationPath: data.location_id ? (locations.find((item) => item.id === data.location_id)?.path ?? null) : null,
    parentAssetName: parentRes.data?.name ?? null,
  });
}

interface PublicAssetRow {
  id: string;
  name: string;
  image_url: string | null;
  asset_code: string;
  category_id: string | null;
  location_id: string | null;
  custom_fields: unknown;
  condition: AssetCondition | null;
  brand: string | null;
  model: string | null;
  description: string | null;
  serial_number: string | null;
  category: { name: string } | null;
  location: { name: string } | null;
  status: { name: string } | null;
  company: {
    id: string;
    slug: string;
    name: string;
    logo_url: string | null;
    primary_color: string | null;
    secondary_color: string | null;
  } | null;
}

function publicLocationPath(
  rows: { id: string; name: string; parent_location_id: string | null }[],
  locationId: string | null,
): string | null {
  if (!locationId) {
    return null;
  }
  const byId = new Map(rows.map((row) => [row.id, row]));
  const names: string[] = [];
  let current = byId.get(locationId);
  const seen = new Set<string>();
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    names.unshift(current.name);
    current = current.parent_location_id ? byId.get(current.parent_location_id) : undefined;
  }
  return names.length > 0 ? names.join(" / ") : null;
}

/**
 * Identification + status for the public QR tag page. Admin client
 * deliberately: scanners have no session, and a signed-in super admin
 * must not pick this up via RLS bypass (this query is scoped to the
 * columns the public page is allowed to show, nothing financial).
 */
export async function getPublicAssetById(id: string): Promise<PublicAsset | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("assets")
    .select(
      "id, name, image_url, asset_code, category_id, location_id, custom_fields, condition, brand, model, description, serial_number, category:asset_categories(name), location:locations(name), status:asset_statuses(name), company:companies(id, slug, name, logo_url, primary_color, secondary_color)",
    )
    .eq("id", id)
    .maybeSingle<PublicAssetRow>();

  if (error || !data || !data.company) {
    return null;
  }

  const stored = asCustomFields(data.custom_fields);
  const definitions = data.category_id ? await listCategoryFieldsAdmin(data.category_id) : [];
  const customFields = definitions
    .map((field) => {
      const value = formatCustomFieldValue(field, stored[field.key]);
      return value ? { label: field.label, value } : null;
    })
    .filter((entry): entry is { label: string; value: string } => entry !== null);

  const { data: locationRows } = data.location_id
    ? await supabase
        .from("locations")
        .select("id, name, parent_location_id")
        .eq("company_id", data.company.id)
        .returns<{ id: string; name: string; parent_location_id: string | null }[]>()
    : { data: [] as { id: string; name: string; parent_location_id: string | null }[] };

  return {
    id: data.id,
    name: data.name,
    imageUrl: data.image_url,
    assetCode: data.asset_code,
    categoryName: data.category?.name ?? null,
    locationName: publicLocationPath(locationRows ?? [], data.location_id) ?? data.location?.name ?? null,
    statusName: data.status?.name ?? "—",
    condition: data.condition,
    brand: data.brand,
    model: data.model,
    description: data.description,
    serialNumber: data.serial_number,
    customFields,
    company: {
      id: data.company.id,
      slug: data.company.slug,
      name: data.company.name,
      logoUrl: data.company.logo_url,
      primaryColor: data.company.primary_color,
      secondaryColor: data.company.secondary_color,
    },
  };
}

interface NameRow {
  id: string;
  name: string;
}

interface UserOptionRow {
  id: string;
  full_name: string | null;
  email: string;
}

/** Just categories + locations + statuses, for the /assets list page's filter bar. */
export async function getAssetFilterOptions(): Promise<{
  categories: AssetOption[];
  locations: AssetOption[];
  statuses: AssetOption[];
  vendors: AssetOption[];
  users: AssetOption[];
  conditions: { key: string; name: string }[];
}> {
  const supabase = createClient();

  const [categoriesRes, statusesRes, locationOptions, vendorsRes, usersRes, conditionsRes] = await Promise.all([
    supabase.from("asset_categories").select("id, name").order("name").returns<NameRow[]>(),
    supabase.from("asset_statuses").select("id, name").order("sort_order").returns<NameRow[]>(),
    listLocationOptions(),
    supabase.from("vendors").select("id, name").eq("is_active", true).order("name").returns<NameRow[]>(),
    supabase.from("users").select("id, full_name, email").order("full_name").returns<UserOptionRow[]>(),
    supabase.from("asset_conditions").select("key, name").eq("is_active", true).order("sort_order").returns<{ key: string; name: string }[]>(),
  ]);

  const toOption = (row: NameRow): AssetOption => ({ id: row.id, name: row.name });

  return {
    categories: (categoriesRes.data ?? []).map(toOption),
    locations: locationOptions.map((location) => ({ id: location.id, name: location.name })),
    statuses: (statusesRes.data ?? []).map(toOption),
    vendors: (vendorsRes.data ?? []).map(toOption),
    users: (usersRes.data ?? []).map((row) => ({ id: row.id, name: row.full_name ?? row.email })),
    conditions: conditionsRes.data ?? [],
  };
}

/**
 * Dropdown/picker options for the create/edit form, all scoped to the
 * caller's own company via RLS. `excludeAssetId` drops the asset being
 * edited out of its own "linked asset" choices.
 */
export async function getAssetFormOptions(excludeAssetId?: string): Promise<AssetFormOptions> {
  const supabase = createClient();

  let linkableQuery = supabase.from("assets").select("id, name").is("deleted_at", null).order("name");
  if (excludeAssetId) {
    linkableQuery = linkableQuery.neq("id", excludeAssetId);
  }

  const [categoriesRes, statusesRes, usersRes, linkableRes, locationOptions, conditionsRes] = await Promise.all([
    supabase.from("asset_categories").select("id, name").order("name").returns<NameRow[]>(),
    supabase.from("asset_statuses").select("id, name").order("sort_order").returns<NameRow[]>(),
    supabase.from("users").select("id, full_name, email").order("full_name").returns<UserOptionRow[]>(),
    linkableQuery.returns<NameRow[]>(),
    listLocationOptions(),
    supabase.from("asset_conditions").select("key, name").eq("is_active", true).order("sort_order").returns<{ key: string; name: string }[]>(),
  ]);

  const toOption = (row: NameRow): AssetOption => ({ id: row.id, name: row.name });

  return {
    categories: (categoriesRes.data ?? []).map(toOption),
    locations: locationOptions.map((location) => ({ id: location.id, name: location.name })),
    statuses: (statusesRes.data ?? []).map(toOption),
    users: (usersRes.data ?? []).map((row) => ({ id: row.id, name: row.full_name ?? row.email })),
    linkableAssets: (linkableRes.data ?? []).map(toOption),
    categoryFields: [],
    conditions: (conditionsRes.data ?? []).map((row) => ({ key: row.key, name: row.name })),
    vendors: [],
    fieldConfig: parseAssetFieldConfig(null),
    departments: [],
    disposalMethods: [],
  };
}

interface AssetDocumentRow {
  id: string;
  file_name: string;
  file_path: string;
  file_size_bytes: number;
  mime_type: string;
  document_type: string | null;
  expires_at: string | null;
  created_at: string;
}

function documentExpiryStatus(expiresAt: string | null): DocumentExpiryStatus {
  if (!expiresAt) {
    return "none";
  }
  const today = isoToday();
  if (expiresAt < today) {
    return "expired";
  }
  if (expiresAt <= isoPlusDays(30)) {
    return "expiring";
  }
  return "ok";
}

/** Attachments for the /assets/[id] Additional Info section. */
export async function getAssetAttachments(assetId: string): Promise<AssetAttachment[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("asset_documents")
    .select("id, file_name, file_path, file_size_bytes, mime_type, document_type, expires_at, created_at")
    .eq("asset_id", assetId)
    .order("created_at", { ascending: false })
    .returns<AssetDocumentRow[]>();

  if (error || !data) {
    return [];
  }

  return data.map((row) => ({
    id: row.id,
    fileName: row.file_name,
    fileUrl: buildR2PublicUrl(row.file_path),
    filePath: row.file_path,
    fileSizeBytes: row.file_size_bytes,
    mimeType: row.mime_type,
    documentType: row.document_type,
    expiresAt: row.expires_at,
    expiryStatus: documentExpiryStatus(row.expires_at),
    createdAt: row.created_at,
  }));
}

export async function getAssetDocumentById(
  id: string,
): Promise<{ id: string; assetId: string; filePath: string; fileSizeBytes: number; fileName: string } | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("asset_documents")
    .select("id, asset_id, file_path, file_size_bytes, file_name")
    .eq("id", id)
    .maybeSingle<{ id: string; asset_id: string; file_path: string; file_size_bytes: number; file_name: string }>();
  if (!data) {
    return null;
  }
  return {
    id: data.id,
    assetId: data.asset_id,
    filePath: data.file_path,
    fileSizeBytes: data.file_size_bytes,
    fileName: data.file_name,
  };
}

export async function listChildAssets(parentAssetId: string): Promise<AssetOption[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("assets")
    .select("id, name")
    .eq("parent_asset_id", parentAssetId)
    .is("deleted_at", null)
    .order("name")
    .returns<NameRow[]>();
  return (data ?? []).map((row) => ({ id: row.id, name: row.name }));
}

export async function listDocumentTypes(): Promise<import("./types").DocumentTypeOption[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("document_types")
    .select("key, name")
    .order("name")
    .returns<{ key: string; name: string }[]>();
  return data ?? [];
}

export async function listMissingRequiredDocuments(
  assetId: string,
): Promise<{ key: string; name: string }[]> {
  const asset = await getAssetById(assetId);
  if (!asset?.categoryId) {
    return [];
  }
  const [requiredByCategory, attachments, types] = await Promise.all([
    listRequiredDocumentsByCategory(),
    getAssetAttachments(assetId),
    listDocumentTypes(),
  ]);
  const required = requiredByCategory.get(asset.categoryId) ?? [];
  const present = new Set(
    attachments.map((row) => row.documentType).filter((value): value is string => Boolean(value)),
  );
  const labels = new Map(types.map((type) => [type.key, type.name]));
  return required.filter((key) => !present.has(key)).map((key) => ({ key, name: labels.get(key) ?? key }));
}

interface AssetStorageObjectRow {
  file_path: string;
  file_size_bytes: number | string;
}

/** R2 keys + sizes for an asset's attachments, used when deleting the asset. */
export async function getAssetStorageObjects(assetId: string): Promise<{ key: string; sizeBytes: number }[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("asset_documents")
    .select("file_path, file_size_bytes")
    .eq("asset_id", assetId)
    .returns<AssetStorageObjectRow[]>();

  if (error || !data) {
    return [];
  }

  return data.map((row) => ({
    key: row.file_path,
    sizeBytes: Number(row.file_size_bytes),
  }));
}

interface WarrantyReminderRow {
  id: string;
  company_id: string;
  name: string;
  asset_code: string;
  warranty_end_date: string | null;
  amc_end_date: string | null;
  insurance_expiry_date: string | null;
}

/**
 * Assets whose warranty/AMC/insurance expires within the next `daysAhead`
 * days, across every company — a system-level scan (like
 * check_storage_thresholds()), not scoped to one caller's session, hence
 * the admin client. Fetches every asset with any of the three dates set
 * and filters in JS rather than building a compound PostgREST `.or()`
 * filter across three independent date ranges, which gets unreadable
 * fast for not much benefit at this data volume.
 */
export async function getUpcomingWarrantyReminders(daysAhead: number): Promise<UpcomingWarrantyReminder[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("assets")
    .select("id, company_id, name, asset_code, warranty_end_date, amc_end_date, insurance_expiry_date")
    .or("warranty_end_date.not.is.null,amc_end_date.not.is.null,insurance_expiry_date.not.is.null")
    .returns<WarrantyReminderRow[]>();

  if (error || !data) {
    return [];
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() + daysAhead);

  const isDueSoon = (dateStr: string | null): dateStr is string => {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    return date >= today && date <= cutoff;
  };

  const reminders: UpcomingWarrantyReminder[] = [];
  const push = (row: WarrantyReminderRow, reason: WarrantyReminderReason, dueDate: string) => {
    reminders.push({
      assetId: row.id,
      companyId: row.company_id,
      name: row.name,
      assetCode: row.asset_code,
      reason,
      dueDate,
    });
  };

  for (const row of data) {
    if (isDueSoon(row.warranty_end_date)) push(row, "warranty", row.warranty_end_date);
    if (isDueSoon(row.amc_end_date)) push(row, "amc", row.amc_end_date);
    if (isDueSoon(row.insurance_expiry_date)) push(row, "insurance", row.insurance_expiry_date);
  }

  return reminders;
}

interface LocationHistoryRow {
  id: string;
  from_location_path: string | null;
  to_location_path: string | null;
  moved_at: string;
  notes: string | null;
  mover: { full_name: string | null; email: string } | null;
}

export async function listAssetLocationHistory(assetId: string): Promise<AssetLocationMove[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("asset_location_history")
    .select("id, from_location_path, to_location_path, moved_at, notes, mover:users!asset_location_history_moved_by_fkey(full_name, email)")
    .eq("asset_id", assetId)
    .order("moved_at", { ascending: false })
    .limit(50)
    .returns<LocationHistoryRow[]>();

  if (error || !data) {
    return [];
  }

  return data.map((row) => ({
    id: row.id,
    fromLocationPath: row.from_location_path,
    toLocationPath: row.to_location_path,
    movedAt: row.moved_at,
    movedByName: row.mover?.full_name ?? row.mover?.email ?? null,
    notes: row.notes,
  }));
}
