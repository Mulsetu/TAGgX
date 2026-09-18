import type { EnabledModules, FeatureModule } from "./feature-catalog";

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
  "by_location",
  "by_category",
  "maintenance_due",
  "warranty_expiry",
  "amc_expiry",
  "insurance_expiry",
  "audit_progress",
  "open_exceptions",
  "pending_approvals",
  "storage_usage",
] as const;
export type DashboardWidgetKey = (typeof DASHBOARD_WIDGET_KEYS)[number];

export interface DashboardWidgetSetting {
  enabled: boolean;
  order: number;
}

export type DashboardWidgetConfig = Record<DashboardWidgetKey, DashboardWidgetSetting>;

export const DASHBOARD_WIDGET_LABELS: Record<DashboardWidgetKey, string> = {
  total_assets: "Total assets",
  active_assets: "Active assets",
  missing_assets: "Missing location",
  unassigned_assets: "Unassigned assets",
  by_location: "Assets by location",
  by_category: "Assets by category",
  maintenance_due: "Maintenance due",
  warranty_expiry: "Warranty expiry",
  amc_expiry: "AMC expiry",
  insurance_expiry: "Insurance expiry",
  audit_progress: "Audit progress",
  open_exceptions: "Open exceptions",
  pending_approvals: "Pending approvals",
  storage_usage: "Storage usage",
};

export const DASHBOARD_WIDGET_MODULES: Record<DashboardWidgetKey, FeatureModule | null> = {
  total_assets: "assets",
  active_assets: "assets",
  missing_assets: "assets",
  unassigned_assets: "lifecycle",
  by_location: "assets",
  by_category: "assets",
  maintenance_due: "maintenance",
  warranty_expiry: "assets",
  amc_expiry: "assets",
  insurance_expiry: "financial",
  audit_progress: "audits",
  open_exceptions: "audits",
  pending_approvals: "approvals",
  storage_usage: null,
};

export function parseDashboardWidgets(value: unknown): DashboardWidgetConfig {
  const raw = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const result = {} as DashboardWidgetConfig;
  DASHBOARD_WIDGET_KEYS.forEach((key, index) => {
    const entry = raw[key];
    const defaults: DashboardWidgetSetting = { enabled: true, order: (index + 1) * 10 };
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      result[key] = defaults;
      return;
    }
    const row = entry as Record<string, unknown>;
    result[key] = {
      enabled: typeof row.enabled === "boolean" ? row.enabled : defaults.enabled,
      order: typeof row.order === "number" && Number.isFinite(row.order) ? row.order : defaults.order,
    };
  });
  return result;
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
