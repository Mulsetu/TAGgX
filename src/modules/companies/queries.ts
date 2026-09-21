import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { CompanyBranding, CompanySummary, WorkspaceExportSheet } from "./types";

interface CompanyBrandingRow {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  contact_address: string | null;
  // Only selected by getCompanyById (the signed-in Settings page lookup) —
  // deliberately left out of the public pre-auth slug lookup so an
  // anonymous visitor on the login page can't see a pending deletion
  // request. Optional here so the other two callers don't need to select
  // columns they don't use.
  deletion_requested_at?: string | null;
  deletion_reason?: string | null;
}

function mapBranding(data: CompanyBrandingRow): CompanyBranding {
  return {
    id: data.id,
    slug: data.slug,
    name: data.name,
    logoUrl: data.logo_url,
    primaryColor: data.primary_color,
    secondaryColor: data.secondary_color,
    contactEmail: data.contact_email,
    contactPhone: data.contact_phone,
    contactAddress: data.contact_address,
    deletionRequestedAt: data.deletion_requested_at ?? null,
    deletionReason: data.deletion_reason ?? null,
  };
}

/**
 * Looks up a company's public branding by slug. Uses the service-role
 * client deliberately: this must work pre-auth (a visitor hasn't signed in
 * yet when they load their company's login page), and RLS on `companies`
 * only ever grants access to `authenticated` users scoped to their own
 * company. Only the columns needed to brand a login page are selected.
 *
 * A reserved slug (see reserved_slugs) can never belong to a real company —
 * the database enforces that at creation time — so this returns null for
 * those too, with no special-casing needed here.
 */
export async function getCompanyBySlug(slug: string): Promise<CompanyBranding | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("companies")
    .select("id, slug, name, logo_url, primary_color, secondary_color, contact_email, contact_phone, contact_address")
    .eq("slug", slug)
    .maybeSingle<CompanyBrandingRow>();

  if (error || !data) {
    return null;
  }

  return mapBranding(data);
}

interface CompanySummaryRow {
  id: string;
  name: string;
  slug: string;
  is_dedicated_infra: boolean;
  suspended_at: string | null;
  created_at: string;
  deletion_requested_at: string | null;
}

interface CompanyEmailRow {
  email: string;
  company_id: string;
}

/**
 * Every company on the platform, for the super-admin company list. Uses
 * the session-bound client deliberately, not the admin client: the
 * `companies_super_admin_bypass` RLS policy already lets an authenticated
 * super admin see every row, so there's no need to step outside RLS here.
 *
 * Admin email is the earliest accepted user on that company, falling
 * back to the earliest invite if nobody has signed in yet.
 */
export async function listCompanies(): Promise<CompanySummary[]> {
  const supabase = createClient();

  // Explicit cap: PostgREST's own default row limit is a project setting,
  // not something this code should depend on silently.
  const companiesRes = await supabase
    .from("companies")
    .select("id, name, slug, is_dedicated_infra, suspended_at, created_at, deletion_requested_at")
    .order("created_at", { ascending: false })
    .limit(1000)
    .returns<CompanySummaryRow[]>();

  if (companiesRes.error || !companiesRes.data) {
    return [];
  }

  // Scoped to just the companies on this page, not a full-table scan:
  // this used to select every row of `users` and `company_invites`
  // platform-wide on every admin page load (just to pick each company's
  // earliest email), which only gets more expensive as the customer base
  // grows — independent of the pagination question above.
  const companyIds = companiesRes.data.map((row) => row.id);
  const [usersRes, invitesRes] = await Promise.all([
    supabase
      .from("users")
      .select("email, company_id")
      .in("company_id", companyIds)
      .order("created_at", { ascending: true })
      .returns<CompanyEmailRow[]>(),
    supabase
      .from("company_invites")
      .select("email, company_id")
      .in("company_id", companyIds)
      .order("created_at", { ascending: true })
      .returns<CompanyEmailRow[]>(),
  ]);

  const emailByCompanyId = new Map<string, string>();
  for (const row of usersRes.data ?? []) {
    if (!emailByCompanyId.has(row.company_id)) {
      emailByCompanyId.set(row.company_id, row.email);
    }
  }
  for (const row of invitesRes.data ?? []) {
    if (!emailByCompanyId.has(row.company_id)) {
      emailByCompanyId.set(row.company_id, row.email);
    }
  }

  return companiesRes.data.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    adminEmail: emailByCompanyId.get(row.id) ?? null,
    isDedicatedInfra: row.is_dedicated_infra,
    suspendedAt: row.suspended_at,
    createdAt: row.created_at,
    deletionRequestedAt: row.deletion_requested_at,
  }));
}

/**
 * Every `public.users.id` belonging to a company, collected right before a
 * cascading delete removes those rows. The FK from `public.users` to
 * `auth.users` cascades the other way (deleting the company cascades to
 * `public.users`, which does NOT touch `auth.users`) — this list is what
 * lets the caller explicitly clean up the matching `auth.users` accounts
 * afterward so the same email can sign up again under a new company. Uses
 * the service-role client: this runs as part of a super-admin-only delete
 * flow that's already authorized before this is called.
 */
export async function getUserIdsForCompany(companyId: string): Promise<string[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("users")
    .select("id")
    .eq("company_id", companyId)
    .returns<{ id: string }[]>();

  if (error || !data) {
    return [];
  }

  return data.map((row) => row.id);
}

/**
 * Looks up a company's branding by id for an already-authenticated caller
 * (e.g. the dashboard top bar). Uses the session-bound client, not the
 * admin client: RLS already scopes an authenticated user to their own
 * company, which is exactly the access this needs.
 */
export async function getCompanyById(id: string): Promise<CompanyBranding | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("companies")
    .select(
      "id, slug, name, logo_url, primary_color, secondary_color, contact_email, contact_phone, contact_address, deletion_requested_at, deletion_reason",
    )
    .eq("id", id)
    .maybeSingle<CompanyBrandingRow>();

  if (error || !data) {
    return null;
  }

  return mapBranding(data);
}

/** Service-role lookup by id — used after unauthenticated Razorpay signup. */
export async function getCompanyByIdAdmin(id: string): Promise<CompanyBranding | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("companies")
    .select("id, slug, name, logo_url, primary_color, secondary_color, contact_email, contact_phone, contact_address")
    .eq("id", id)
    .maybeSingle<CompanyBrandingRow>();

  if (error || !data) {
    return null;
  }

  return mapBranding(data);
}

/** Pre-auth / sign-in: whether the platform has suspended this company. */
export async function getCompanySuspendedAt(companyId: string): Promise<string | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("companies")
    .select("suspended_at")
    .eq("id", companyId)
    .maybeSingle<{ suspended_at: string | null }>();
  return data?.suspended_at ?? null;
}

interface WorkspaceSettingsRow {
  asset_code_format: string;
  enabled_modules: unknown;
  asset_field_config: unknown;
  dashboard_widgets: unknown;
  dashboard_layouts: unknown;
  workflow_config: unknown;
  department_catalog: unknown;
  disposal_methods: unknown;
}

export async function getCompanyWorkspaceSettings(companyId: string): Promise<{
  assetCodeFormat: string;
  enabledModules: unknown;
  assetFieldConfig: unknown;
  dashboardWidgets: unknown;
  dashboardLayouts: unknown;
  workflowConfig: unknown;
  departmentCatalog: unknown;
  disposalMethods: unknown;
}> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("company_settings")
    .select(
      "asset_code_format, enabled_modules, asset_field_config, dashboard_widgets, dashboard_layouts, workflow_config, department_catalog, disposal_methods",
    )
    .eq("company_id", companyId)
    .maybeSingle<WorkspaceSettingsRow>();

  if (error) {
    const fallback = await supabase
      .from("company_settings")
      .select(
        "asset_code_format, enabled_modules, asset_field_config, dashboard_widgets, workflow_config, department_catalog, disposal_methods",
      )
      .eq("company_id", companyId)
      .maybeSingle<Omit<WorkspaceSettingsRow, "dashboard_layouts">>();
    return {
      assetCodeFormat: fallback.data?.asset_code_format ?? "AST-{SEQ:05d}",
      enabledModules: fallback.data?.enabled_modules ?? null,
      assetFieldConfig: fallback.data?.asset_field_config ?? null,
      dashboardWidgets: fallback.data?.dashboard_widgets ?? null,
      dashboardLayouts: null,
      workflowConfig: fallback.data?.workflow_config ?? null,
      departmentCatalog: fallback.data?.department_catalog ?? null,
      disposalMethods: fallback.data?.disposal_methods ?? null,
    };
  }

  return {
    assetCodeFormat: data?.asset_code_format ?? "AST-{SEQ:05d}",
    enabledModules: data?.enabled_modules ?? null,
    assetFieldConfig: data?.asset_field_config ?? null,
    dashboardWidgets: data?.dashboard_widgets ?? null,
    dashboardLayouts: data?.dashboard_layouts ?? null,
    workflowConfig: data?.workflow_config ?? null,
    departmentCatalog: data?.department_catalog ?? null,
    disposalMethods: data?.disposal_methods ?? null,
  };
}

// Per-sheet safety cap for the Settings > "Export my data" download —
// same rationale as the .limit() calls added across the list queries:
// an explicit, predictable bound instead of depending on PostgREST's own
// default. Generous enough that no real tenant should ever hit it, but a
// tenant that somehow does still gets a complete-looking file rather than
// a silently truncated one with no indication anything was cut off.
const EXPORT_ROW_CAP = 5000;

function cell(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  return String(value);
}

interface ExportAssetRow {
  asset_code: string;
  name: string;
  condition: string | null;
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  vendor: string | null;
  purchase_date: string | null;
  purchase_price: number | null;
  warranty_end_date: string | null;
  amc_end_date: string | null;
  insurance_expiry_date: string | null;
  created_at: string;
  category: { name: string } | null;
  location: { name: string } | null;
  status: { name: string } | null;
  allotted_user: { full_name: string | null; email: string } | null;
}

interface ExportLocationRow {
  name: string;
  kind: string;
  city: string | null;
  state: string | null;
  country: string | null;
}

interface ExportCategoryRow {
  name: string;
  description: string | null;
  code_prefix: string | null;
  is_active: boolean;
}

interface ExportTicketRow {
  title: string;
  status: string;
  priority: string;
  opened_at: string;
  resolved_at: string | null;
  asset: { name: string; asset_code: string } | null;
  assigned_to_user: { full_name: string | null; email: string } | null;
}

interface ExportPlanRow {
  name: string;
  frequency: string;
  next_due_at: string;
  is_active: boolean;
}

interface ExportVendorRow {
  name: string;
  company_name: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  is_active: boolean;
}

interface ExportUserRow {
  email: string;
  full_name: string | null;
  is_active: boolean;
  created_at: string;
  roles: { name: string } | null;
}

interface ExportAuditRow {
  created_at: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  actor: { full_name: string | null; email: string } | null;
}

/**
 * Everything a Company Admin's Settings > "Export my data" download
 * contains. Session-scoped client throughout, never the admin client —
 * RLS already scopes every one of these tables to the caller's own
 * company, so there's no `company_id` filter to get wrong here.
 */
export async function getWorkspaceExportData(): Promise<WorkspaceExportSheet[]> {
  const supabase = createClient();

  const [assets, locations, categories, tickets, plans, vendors, users, auditLog] = await Promise.all([
    supabase
      .from("assets")
      .select(
        "asset_code, name, condition, brand, model, serial_number, vendor, purchase_date, purchase_price, warranty_end_date, amc_end_date, insurance_expiry_date, created_at, category:asset_categories(name), location:locations(name), status:asset_statuses(name), allotted_user:users!assets_allotted_to_fkey(full_name, email)",
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(EXPORT_ROW_CAP)
      .returns<ExportAssetRow[]>(),
    supabase
      .from("locations")
      .select("name, kind, city, state, country")
      .order("name")
      .limit(EXPORT_ROW_CAP)
      .returns<ExportLocationRow[]>(),
    supabase
      .from("asset_categories")
      .select("name, description, code_prefix, is_active")
      .order("name")
      .limit(EXPORT_ROW_CAP)
      .returns<ExportCategoryRow[]>(),
    supabase
      .from("maintenance_tickets")
      .select(
        "title, status, priority, opened_at, resolved_at, asset:assets(name, asset_code), assigned_to_user:users!maintenance_tickets_assigned_to_fkey(full_name, email)",
      )
      .order("opened_at", { ascending: false })
      .limit(EXPORT_ROW_CAP)
      .returns<ExportTicketRow[]>(),
    supabase
      .from("maintenance_plans")
      .select("name, frequency, next_due_at, is_active")
      .order("next_due_at")
      .limit(EXPORT_ROW_CAP)
      .returns<ExportPlanRow[]>(),
    supabase
      .from("vendors")
      .select("name, company_name, contact_name, email, phone, is_active")
      .order("name")
      .limit(EXPORT_ROW_CAP)
      .returns<ExportVendorRow[]>(),
    supabase
      .from("users")
      .select("email, full_name, is_active, created_at, roles(name)")
      .order("created_at")
      .limit(EXPORT_ROW_CAP)
      .returns<ExportUserRow[]>(),
    supabase
      .from("audit_log")
      .select("created_at, action, entity_type, entity_id, actor:users(full_name, email)")
      .order("created_at", { ascending: false })
      .limit(EXPORT_ROW_CAP)
      .returns<ExportAuditRow[]>(),
  ]);

  return [
    {
      name: "Assets",
      columns: [
        "Asset code",
        "Name",
        "Category",
        "Location",
        "Status",
        "Condition",
        "Brand",
        "Model",
        "Serial number",
        "Vendor",
        "Purchase date",
        "Purchase price",
        "Allotted to",
        "Warranty end",
        "AMC end",
        "Insurance expiry",
        "Created at",
      ],
      rows: (assets.data ?? []).map((row) => [
        cell(row.asset_code),
        cell(row.name),
        cell(row.category?.name),
        cell(row.location?.name),
        cell(row.status?.name),
        cell(row.condition),
        cell(row.brand),
        cell(row.model),
        cell(row.serial_number),
        cell(row.vendor),
        cell(row.purchase_date),
        cell(row.purchase_price),
        cell(row.allotted_user?.full_name ?? row.allotted_user?.email),
        cell(row.warranty_end_date),
        cell(row.amc_end_date),
        cell(row.insurance_expiry_date),
        cell(row.created_at),
      ]),
    },
    {
      name: "Locations",
      columns: ["Name", "Kind", "City", "State", "Country"],
      rows: (locations.data ?? []).map((row) => [cell(row.name), cell(row.kind), cell(row.city), cell(row.state), cell(row.country)]),
    },
    {
      name: "Categories",
      columns: ["Name", "Description", "Code prefix", "Active"],
      rows: (categories.data ?? []).map((row) => [cell(row.name), cell(row.description), cell(row.code_prefix), cell(row.is_active)]),
    },
    {
      name: "Maintenance tickets",
      columns: ["Title", "Status", "Priority", "Asset", "Assigned to", "Opened at", "Resolved at"],
      rows: (tickets.data ?? []).map((row) => [
        cell(row.title),
        cell(row.status),
        cell(row.priority),
        cell(row.asset ? `${row.asset.name} (${row.asset.asset_code})` : ""),
        cell(row.assigned_to_user?.full_name ?? row.assigned_to_user?.email),
        cell(row.opened_at),
        cell(row.resolved_at),
      ]),
    },
    {
      name: "Maintenance plans",
      columns: ["Name", "Frequency", "Next due", "Active"],
      rows: (plans.data ?? []).map((row) => [cell(row.name), cell(row.frequency), cell(row.next_due_at), cell(row.is_active)]),
    },
    {
      name: "Vendors",
      columns: ["Name", "Company", "Contact", "Email", "Phone", "Active"],
      rows: (vendors.data ?? []).map((row) => [
        cell(row.name),
        cell(row.company_name),
        cell(row.contact_name),
        cell(row.email),
        cell(row.phone),
        cell(row.is_active),
      ]),
    },
    {
      name: "Users",
      columns: ["Email", "Full name", "Role", "Active", "Created at"],
      rows: (users.data ?? []).map((row) => [
        cell(row.email),
        cell(row.full_name),
        cell(row.roles?.name),
        cell(row.is_active),
        cell(row.created_at),
      ]),
    },
    {
      name: "Audit log",
      columns: ["Date", "Actor", "Action", "Entity type", "Entity id"],
      rows: (auditLog.data ?? []).map((row) => [
        cell(row.created_at),
        cell(row.actor?.full_name ?? row.actor?.email),
        cell(row.action),
        cell(row.entity_type),
        cell(row.entity_id),
      ]),
    },
  ];
}

