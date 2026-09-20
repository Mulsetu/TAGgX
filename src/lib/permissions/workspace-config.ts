import type { EnabledModules, FeatureModule } from "./feature-catalog";
import type { PermissionModule } from "./taxonomy";

export const ASSET_FIELD_KEYS = [
  "serialNumber",
  "brand",
  "model",
  "description",
  "condition",
  "linkedAssetId",
  "parentAssetId",
  "cwipInvoiceId",
  "department",
  "tags",
  "criticality",
  "notes",
  "vendorId",
  "poNumber",
  "invoiceDate",
  "invoiceNumber",
  "purchaseDate",
  "purchasePrice",
  "usefulLifeYears",
  "currentBookValue",
  "residualValue",
  "ownershipType",
  "allottedTo",
  "allotmentDate",
  "warrantyStartDate",
  "warrantyEndDate",
  "amcProvider",
  "amcStartDate",
  "amcEndDate",
  "insuranceProvider",
  "insurancePolicyNumber",
  "insuranceExpiryDate",
] as const;
export type AssetFieldKey = (typeof ASSET_FIELD_KEYS)[number];

export interface AssetFieldSetting {
  enabled: boolean;
  required: boolean;
  label: string;
  order: number;
}

export type AssetFieldConfig = Record<AssetFieldKey, AssetFieldSetting>;

export const ASSET_FIELD_LABELS: Record<AssetFieldKey, string> = {
  serialNumber: "Serial number",
  brand: "Brand",
  model: "Model",
  description: "Description",
  condition: "Condition",
  linkedAssetId: "Linked asset",
  parentAssetId: "Parent asset",
  cwipInvoiceId: "CWIP invoice ID",
  department: "Department",
  tags: "Keywords / tags",
  criticality: "Criticality",
  notes: "Notes",
  vendorId: "Vendor",
  poNumber: "PO number",
  invoiceDate: "Invoice date",
  invoiceNumber: "Invoice number",
  purchaseDate: "Purchase date",
  purchasePrice: "Purchase price",
  usefulLifeYears: "Useful life (years)",
  currentBookValue: "Current book value",
  residualValue: "Residual value",
  ownershipType: "Ownership",
  allottedTo: "Allotted to",
  allotmentDate: "Allotment date",
  warrantyStartDate: "Warranty start",
  warrantyEndDate: "Warranty end",
  amcProvider: "AMC provider",
  amcStartDate: "AMC start",
  amcEndDate: "AMC end",
  insuranceProvider: "Insurance provider",
  insurancePolicyNumber: "Insurance policy number",
  insuranceExpiryDate: "Insurance expiry",
};

const FIELD_MODULE: Partial<Record<AssetFieldKey, FeatureModule>> = {
  vendorId: "vendors",
  department: "departments",
  purchasePrice: "financial",
  usefulLifeYears: "financial",
  currentBookValue: "financial",
  residualValue: "financial",
  allottedTo: "lifecycle",
  allotmentDate: "lifecycle",
  insuranceProvider: "financial",
  insurancePolicyNumber: "financial",
  insuranceExpiryDate: "financial",
};

function defaultFieldSetting(key: AssetFieldKey, index: number): AssetFieldSetting {
  return {
    enabled: true,
    required: false,
    label: ASSET_FIELD_LABELS[key],
    order: (index + 1) * 10,
  };
}

export function parseAssetFieldConfig(value: unknown): AssetFieldConfig {
  const raw = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const result = {} as AssetFieldConfig;
  ASSET_FIELD_KEYS.forEach((key, index) => {
    const entry = raw[key];
    const defaults = defaultFieldSetting(key, index);
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      result[key] = defaults;
      return;
    }
    const row = entry as Record<string, unknown>;
    result[key] = {
      enabled: typeof row.enabled === "boolean" ? row.enabled : defaults.enabled,
      required: typeof row.required === "boolean" ? row.required : defaults.required,
      label: typeof row.label === "string" && row.label.trim() ? row.label.trim().slice(0, 80) : defaults.label,
      order: typeof row.order === "number" && Number.isFinite(row.order) ? row.order : defaults.order,
    };
  });
  return result;
}

export function applyModuleFieldVisibility(config: AssetFieldConfig, modules: EnabledModules): AssetFieldConfig {
  const next = { ...config };
  for (const key of ASSET_FIELD_KEYS) {
    const moduleKey = FIELD_MODULE[key];
    if (moduleKey && !modules[moduleKey]) {
      next[key] = { ...next[key], enabled: false, required: false };
    }
  }
  return next;
}

export const DASHBOARD_WIDGET_KEYS = [
  "total_assets",
  "active_assets",
  "missing_assets",
  "unassigned_assets",
  "assets_under_maintenance",
  "by_location",
  "by_category",
  "by_status",
  "maintenance_due",
  "upcoming_maintenance",
  "open_tickets",
  "warranty_expiry",
  "amc_expiry",
  "insurance_expiry",
  "document_expiry",
  "audit_progress",
  "pending_audits",
  "open_exceptions",
  "missing_from_audit",
  "pending_approvals",
  "vendor_summary",
  "storage_usage",
] as const;
export type DashboardWidgetKey = (typeof DASHBOARD_WIDGET_KEYS)[number];

export const DASHBOARD_WIDGET_SIZES = ["sm", "md", "lg"] as const;
export type DashboardWidgetSize = (typeof DASHBOARD_WIDGET_SIZES)[number];

export type DashboardWidgetKind = "stat" | "chart";

export interface DashboardWidgetSetting {
  enabled: boolean;
  order: number;
  size: DashboardWidgetSize;
}

export type DashboardWidgetConfig = Record<DashboardWidgetKey, DashboardWidgetSetting>;

export const DASHBOARD_WIDGET_LABELS: Record<DashboardWidgetKey, string> = {
  total_assets: "Total assets",
  active_assets: "Active assets",
  missing_assets: "Missing location",
  unassigned_assets: "Unassigned assets",
  assets_under_maintenance: "Assets under maintenance",
  by_location: "Assets by location",
  by_category: "Assets by category",
  by_status: "Assets by status",
  maintenance_due: "Overdue maintenance",
  upcoming_maintenance: "Upcoming maintenance",
  open_tickets: "Open tickets",
  warranty_expiry: "Warranty expiry",
  amc_expiry: "AMC expiry",
  insurance_expiry: "Insurance expiry",
  document_expiry: "Document expiry",
  audit_progress: "Audit progress",
  pending_audits: "Pending audits",
  open_exceptions: "Audit findings",
  missing_from_audit: "Missing from audit",
  pending_approvals: "Pending transfers",
  vendor_summary: "Vendor summary",
  storage_usage: "Storage usage",
};

export const DASHBOARD_WIDGET_KIND: Record<DashboardWidgetKey, DashboardWidgetKind> = {
  total_assets: "stat",
  active_assets: "stat",
  missing_assets: "stat",
  unassigned_assets: "stat",
  assets_under_maintenance: "stat",
  by_location: "chart",
  by_category: "chart",
  by_status: "chart",
  maintenance_due: "stat",
  upcoming_maintenance: "stat",
  open_tickets: "chart",
  warranty_expiry: "stat",
  amc_expiry: "stat",
  insurance_expiry: "stat",
  document_expiry: "stat",
  audit_progress: "stat",
  pending_audits: "stat",
  open_exceptions: "stat",
  missing_from_audit: "stat",
  pending_approvals: "stat",
  vendor_summary: "stat",
  storage_usage: "stat",
};

export const DASHBOARD_WIDGET_MODULES: Record<DashboardWidgetKey, FeatureModule | null> = {
  total_assets: "assets",
  active_assets: "assets",
  missing_assets: "assets",
  unassigned_assets: "lifecycle",
  assets_under_maintenance: "maintenance",
  by_location: "assets",
  by_category: "assets",
  by_status: "assets",
  maintenance_due: "maintenance",
  upcoming_maintenance: "maintenance",
  open_tickets: "maintenance",
  warranty_expiry: "assets",
  amc_expiry: "assets",
  insurance_expiry: "financial",
  document_expiry: "documents",
  audit_progress: "audits",
  pending_audits: "audits",
  open_exceptions: "audits",
  missing_from_audit: "audits",
  pending_approvals: "approvals",
  vendor_summary: "vendors",
  storage_usage: null,
};

export const DASHBOARD_WIDGET_PERMISSIONS: Record<DashboardWidgetKey, PermissionModule | null> = {
  total_assets: "assets",
  active_assets: "assets",
  missing_assets: "assets",
  unassigned_assets: "assets",
  assets_under_maintenance: "maintenance",
  by_location: "assets",
  by_category: "assets",
  by_status: "assets",
  maintenance_due: "maintenance",
  upcoming_maintenance: "maintenance",
  open_tickets: "maintenance",
  warranty_expiry: "assets",
  amc_expiry: "assets",
  insurance_expiry: "assets",
  document_expiry: "assets",
  audit_progress: "audits",
  pending_audits: "audits",
  open_exceptions: "audits",
  missing_from_audit: "audits",
  pending_approvals: "handover",
  vendor_summary: "vendors",
  storage_usage: "settings",
};

export function defaultWidgetSetting(index: number, kind: DashboardWidgetKind): DashboardWidgetSetting {
  return {
    enabled: true,
    order: (index + 1) * 10,
    size: kind === "chart" ? "md" : "sm",
  };
}

export function parseDashboardWidgets(value: unknown): DashboardWidgetConfig {
  const raw = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const result = {} as DashboardWidgetConfig;
  DASHBOARD_WIDGET_KEYS.forEach((key, index) => {
    const entry = raw[key];
    const defaults = defaultWidgetSetting(index, DASHBOARD_WIDGET_KIND[key]);
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      result[key] = defaults;
      return;
    }
    const row = entry as Record<string, unknown>;
    const size = row.size;
    result[key] = {
      enabled: typeof row.enabled === "boolean" ? row.enabled : defaults.enabled,
      order: typeof row.order === "number" && Number.isFinite(row.order) ? row.order : defaults.order,
      size: size === "sm" || size === "md" || size === "lg" ? size : defaults.size,
    };
  });
  return result;
}

export interface DashboardLayouts {
  roles: Record<string, DashboardWidgetConfig>;
}

export function parseDashboardLayouts(value: unknown): DashboardLayouts {
  const raw = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const rolesRaw =
    raw.roles && typeof raw.roles === "object" && !Array.isArray(raw.roles)
      ? (raw.roles as Record<string, unknown>)
      : {};
  const roles: Record<string, DashboardWidgetConfig> = {};
  for (const [roleId, config] of Object.entries(rolesRaw)) {
    if (roleId.length > 0 && roleId.length <= 64) {
      roles[roleId] = parseDashboardWidgets(config);
    }
  }
  return { roles };
}

export function resolveDashboardWidgets(
  companyWidgets: DashboardWidgetConfig,
  layouts: DashboardLayouts,
  roleId: string | null,
): DashboardWidgetConfig {
  if (roleId && layouts.roles[roleId]) {
    return layouts.roles[roleId];
  }
  return companyWidgets;
}

export const DASHBOARD_WIDGET_HREFS: Record<DashboardWidgetKey, string> = {
  total_assets: "/assets",
  active_assets: "/assets",
  missing_assets: "/dashboard/administration/reports",
  unassigned_assets: "/dashboard/administration/reports",
  assets_under_maintenance: "/dashboard/administration/maintenance",
  by_location: "/assets",
  by_category: "/assets",
  by_status: "/assets",
  maintenance_due: "/dashboard/administration/maintenance",
  upcoming_maintenance: "/dashboard/administration/maintenance",
  open_tickets: "/dashboard/administration/maintenance",
  warranty_expiry: "/dashboard/administration/reports",
  amc_expiry: "/dashboard/administration/reports",
  insurance_expiry: "/dashboard/administration/reports",
  document_expiry: "/assets?docs=expiring",
  audit_progress: "/dashboard/administration/audits",
  pending_audits: "/dashboard/administration/audits",
  open_exceptions: "/dashboard/administration/audits",
  missing_from_audit: "/dashboard/administration/audits",
  pending_approvals: "/assets",
  vendor_summary: "/dashboard/administration/vendors",
  storage_usage: "/dashboard/administration/settings",
};

export function widgetEnabledByModules(key: DashboardWidgetKey, modules: EnabledModules): boolean {
  const feature = DASHBOARD_WIDGET_MODULES[key];
  return !feature || modules[feature];
}

export const WORKFLOW_KEYS = [
  "transfer_approval",
  "disposal_approval",
  "maintenance_approval",
  "asset_request_approval",
] as const;
export type WorkflowKey = (typeof WORKFLOW_KEYS)[number];

export type WorkflowConfig = Record<WorkflowKey, boolean>;

export const WORKFLOW_LABELS: Record<WorkflowKey, string> = {
  transfer_approval: "Transfer acknowledgement",
  disposal_approval: "Disposal requires dispose permission",
  maintenance_approval: "Maintenance approval (reserved)",
  asset_request_approval: "Asset request approval (reserved)",
};

export const WORKFLOW_DESCRIPTIONS: Record<WorkflowKey, string> = {
  transfer_approval: "Custodian transfers wait for the receiving user to accept or reject.",
  disposal_approval: "Only roles with Dispose can record disposal. When off, Edit is enough.",
  maintenance_approval: "Stored for a later release; tickets are not blocked yet.",
  asset_request_approval: "Stored for a later release; allocation is not blocked yet.",
};

export function parseWorkflowConfig(value: unknown): WorkflowConfig {
  const raw = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  return {
    transfer_approval: typeof raw.transfer_approval === "boolean" ? raw.transfer_approval : true,
    disposal_approval: typeof raw.disposal_approval === "boolean" ? raw.disposal_approval : false,
    maintenance_approval: typeof raw.maintenance_approval === "boolean" ? raw.maintenance_approval : false,
    asset_request_approval: typeof raw.asset_request_approval === "boolean" ? raw.asset_request_approval : false,
  };
}

export function parseStringCatalog(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const seen = new Set<string>();
  const result: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string") {
      continue;
    }
    const name = entry.trim().slice(0, 80);
    const key = name.toLowerCase();
    if (!name || seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(name);
  }
  return result.slice(0, 200);
}

export function parseCatalogText(value: string): string[] {
  return parseStringCatalog(
    value
      .split(/\r?\n|,/)
      .map((entry) => entry.trim())
      .filter(Boolean),
  );
}
