export const FEATURE_MODULES = [
  "assets",
  "qr",
  "audits",
  "lifecycle",
  "handover",
  "transfers",
  "maintenance",
  "preventive_maintenance",
  "documents",
  "vendors",
  "reports",
  "email",
  "approvals",
  "departments",
  "custom_fields",
  "disposal",
  "financial",
] as const;
export type FeatureModule = (typeof FEATURE_MODULES)[number];

export const FEATURE_MODULE_LABELS: Record<FeatureModule, string> = {
  assets: "Asset register",
  qr: "QR management",
  audits: "Asset audits",
  lifecycle: "Asset lifecycle",
  handover: "Handover and return",
  transfers: "Transfer management",
  maintenance: "Maintenance",
  preventive_maintenance: "Preventive maintenance",
  documents: "Documents",
  vendors: "Vendors",
  reports: "Reports",
  email: "Email automation",
  approvals: "Approvals",
  departments: "Departments",
  custom_fields: "Custom fields",
  disposal: "Disposal",
  financial: "Financial information",
};

export const FEATURE_MODULE_DESCRIPTIONS: Record<FeatureModule, string> = {
  assets: "Asset list, create, and edit.",
  qr: "QR tag generation on asset records.",
  audits: "Physical audit campaigns and floor scan mode.",
  lifecycle: "Allotment fields and custody history on the asset form.",
  handover: "Handover and return workflows.",
  transfers: "Location and custodian transfers.",
  maintenance: "Tickets, assignment, and repair tracking.",
  preventive_maintenance: "Recurring maintenance plans and scheduled tickets.",
  documents: "Attachments, document types, and expiry tracking.",
  vendors: "Vendor records and vendor-scoped ticket access.",
  reports: "Standard reports, CSV export, and bulk import.",
  email: "Transactional email templates, rules, and logs.",
  approvals: "Optional approval workflows and pending-approval widgets.",
  departments: "Company department catalog on assets.",
  custom_fields: "Category-specific custom fields on asset forms.",
  disposal: "Record disposal against a final status.",
  financial: "Purchase price, book value, residual value, and useful life.",
};

/**
 * Existing companies stored only the original six keys. Missing keys inherit
 * so production tenants do not lose access when the catalog grows.
 */
export const DEFAULT_ENABLED_MODULES: Record<FeatureModule, boolean> = {
  assets: true,
  qr: true,
  audits: true,
  lifecycle: true,
  handover: true,
  transfers: true,
  maintenance: true,
  preventive_maintenance: true,
  documents: true,
  vendors: true,
  reports: true,
  email: true,
  approvals: false,
  departments: false,
  custom_fields: true,
  disposal: true,
  financial: true,
};

/** Conservative defaults for a brand-new company when its plan lists no modules. */
export const NEW_COMPANY_DEFAULT_MODULES: Record<FeatureModule, boolean> = {
  assets: true,
  qr: true,
  audits: false,
  lifecycle: true,
  handover: true,
  transfers: true,
  maintenance: false,
  preventive_maintenance: false,
  documents: true,
  vendors: false,
  reports: true,
  email: true,
  approvals: false,
  departments: false,
  custom_fields: true,
  disposal: false,
  financial: false,
};

export type EnabledModules = Record<FeatureModule, boolean>;

const LEGACY_KEYS = [
  "maintenance",
  "audits",
  "vendors",
  "handover",
  "preventive_maintenance",
  "reports",
] as const;

export function emptyEnabledModules(value: boolean): EnabledModules {
  const result = { ...DEFAULT_ENABLED_MODULES };
  for (const key of FEATURE_MODULES) {
    result[key] = value;
  }
  return result;
}

export function parseEnabledModules(value: unknown): EnabledModules {
  const raw = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const result = { ...DEFAULT_ENABLED_MODULES };
  for (const key of FEATURE_MODULES) {
    const entry = raw[key];
    if (typeof entry === "boolean") {
      result[key] = entry;
    }
  }
  if (typeof raw.transfers !== "boolean") {
    result.transfers = result.handover;
  }
  if (typeof raw.disposal !== "boolean") {
    result.disposal = result.handover;
  }
  return result;
}

/** Defaults for a newly provisioned tenant (plan-aware). */
export function defaultModulesForPlan(included: FeatureModule[] | null): EnabledModules {
  if (!included) {
    return { ...NEW_COMPANY_DEFAULT_MODULES };
  }
  const allowed = new Set(included);
  const result = emptyEnabledModules(false);
  for (const key of FEATURE_MODULES) {
    result[key] = allowed.has(key);
  }
  if (!allowed.has("assets")) {
    result.assets = true;
  }
  return result;
}

export function parsePlanModules(value: unknown): FeatureModule[] | null {
  if (value == null) {
    return null;
  }
  if (!Array.isArray(value)) {
    return null;
  }
  const allowed = new Set<FeatureModule>(FEATURE_MODULES);
  const modules = value.filter((entry): entry is FeatureModule => typeof entry === "string" && allowed.has(entry as FeatureModule));
  return modules;
}

export function clampModulesToPlan(company: EnabledModules, planModules: FeatureModule[] | null): EnabledModules {
  if (!planModules) {
    return company;
  }
  const allowed = new Set(planModules);
  const result = { ...company };
  for (const key of FEATURE_MODULES) {
    result[key] = company[key] && allowed.has(key);
  }
  return result;
}

export const EMAIL_EVENT_MODULES: Record<string, FeatureModule> = {
  asset_assigned: "handover",
  asset_returned: "handover",
  asset_transferred: "transfers",
  transfer_pending: "transfers",
  transfer_accepted: "transfers",
  transfer_rejected: "transfers",
  maintenance_created: "maintenance",
  maintenance_assigned: "maintenance",
  maintenance_due: "maintenance",
  vendor_assigned: "vendors",
  warranty_expiry: "assets",
  amc_expiry: "assets",
  insurance_expiry: "financial",
  document_expiry: "documents",
  storage_alert: "email",
};

export const REPORT_MODULE_MAP: Record<string, FeatureModule> = {
  asset_register: "assets",
  by_status: "assets",
  by_location: "assets",
  by_custodian: "lifecycle",
  missing_unassigned: "assets",
  maintenance_overdue: "maintenance",
  warranty_amc: "assets",
  audit_exceptions: "audits",
};

export function isLegacyStoredModules(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return true;
  }
  const raw = value as Record<string, unknown>;
  return LEGACY_KEYS.every((key) => typeof raw[key] === "boolean") && typeof raw.assets !== "boolean";
}
