export const REPORT_KEYS = [
  "asset_register",
  "by_status",
  "by_location",
  "by_custodian",
  "missing_unassigned",
  "maintenance_overdue",
  "warranty_amc",
  "audit_exceptions",
] as const;
export type ReportKey = (typeof REPORT_KEYS)[number];

export const REPORT_LABELS: Record<ReportKey, string> = {
  asset_register: "Asset register",
  by_status: "Assets by status",
  by_location: "Assets by location",
  by_custodian: "Assets by custodian",
  missing_unassigned: "Missing location or unassigned",
  maintenance_overdue: "Overdue maintenance",
  warranty_amc: "Warranty / AMC / insurance",
  audit_exceptions: "Audit exceptions",
};

export const REPORT_DESCRIPTIONS: Record<ReportKey, string> = {
  asset_register: "Every asset with its code, category, location, status, custodian, purchase and cover dates.",
  by_status: "How many assets are in each status.",
  by_location: "How many assets sit at each location.",
  by_custodian: "How many assets each person holds.",
  missing_unassigned: "Assets with no location or no custodian — the gaps to clean up.",
  maintenance_overdue: "Open maintenance tickets that are past their due date.",
  warranty_amc: "Assets whose warranty, AMC or insurance is still running — to plan renewals.",
  audit_exceptions: "Every problem found across audits, with the auditor's notes.",
};

const ASSET_REPORT_COLUMNS = [
  "Name",
  "Code",
  "Category",
  "Location",
  "Status",
  "Condition",
  "Custodian",
  "Brand",
  "Model",
  "Serial",
  "Vendor",
  "Purchase date",
  "Warranty end",
  "AMC end",
  "Insurance end",
];

/** Every column each report can contain; the builder lets people pick a subset. */
export const REPORT_COLUMNS: Record<ReportKey, string[]> = {
  asset_register: ASSET_REPORT_COLUMNS,
  by_status: ["Status", "Count"],
  by_location: ["Location", "Count"],
  by_custodian: ["Custodian", "Count"],
  missing_unassigned: ASSET_REPORT_COLUMNS,
  maintenance_overdue: ["Title", "Asset", "Code", "Due", "Status", "Priority"],
  warranty_amc: ASSET_REPORT_COLUMNS,
  audit_exceptions: ["Audit", "Date", "Asset", "Code", "Exceptions", "Notes"],
};

/** Which filters make sense per report: asset category/location/status, and what the date range applies to. */
export const REPORT_FILTERS: Record<ReportKey, { assetFilters: boolean; dateLabel: string }> = {
  asset_register: { assetFilters: true, dateLabel: "Purchase date" },
  by_status: { assetFilters: true, dateLabel: "Purchase date" },
  by_location: { assetFilters: true, dateLabel: "Purchase date" },
  by_custodian: { assetFilters: true, dateLabel: "Purchase date" },
  missing_unassigned: { assetFilters: true, dateLabel: "Purchase date" },
  maintenance_overdue: { assetFilters: true, dateLabel: "Due date" },
  warranty_amc: { assetFilters: true, dateLabel: "Purchase date" },
  audit_exceptions: { assetFilters: false, dateLabel: "Audit date" },
};

export interface ReportFilters {
  categoryId?: string;
  locationId?: string;
  statusId?: string;
  from?: string;
  to?: string;
  includeArchived?: boolean;
}

export interface ReportTable {
  columns: string[];
  rows: string[][];
}

export interface ExportResult {
  filename: string;
  content: string;
  mime: string;
  encoding?: "utf8" | "base64";
}

export interface ReportFormState {
  error: string | null;
  export?: ExportResult;
  rowCount?: number;
}


export interface DashboardTile {
  id: string;
  label: string;
  value: number;
  href: string;
}

export const DASHBOARD_PERIODS = ["all", "7d", "30d", "90d", "365d"] as const;
export type DashboardPeriod = (typeof DASHBOARD_PERIODS)[number];

export const DASHBOARD_PERIOD_LABELS: Record<DashboardPeriod, string> = {
  all: "All time",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  "365d": "Last 12 months",
};

export interface DashboardHomeWidget {
  id: string;
  label: string;
  kind: "stat" | "chart";
  size: "sm" | "md" | "lg";
  href: string;
  value: number | null;
  /** Same stat for the previous window of equal length; null for "All time" or non-period stats. */
  previousValue: number | null;
  chart: { name: string; value: number }[];
}
