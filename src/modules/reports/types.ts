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
}

export interface ImportFormState {
  error: string | null;
  result?: { successCount: number; errorCount: number; errorCsv?: string };
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
