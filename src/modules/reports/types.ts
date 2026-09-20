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

export interface ImportPreviewRow {
  line: number;
  values: Record<string, string>;
  error?: string;
}

export interface ImportJobSummary {
  id: string;
  status: string;
  totalRows: number;
  successCount: number;
  errorCount: number;
  createdAt: string;
  errorReport: string | null;
}

export interface ImportFormState {
  error: string | null;
  preview?: ImportPreviewRow[];
  result?: { successCount: number; errorCount: number; errorCsv?: string };
}

export interface DashboardTile {
  id: string;
  label: string;
  value: number;
  href: string;
}

export interface DashboardHomeWidget {
  id: string;
  label: string;
  kind: "stat" | "chart";
  size: "sm" | "md" | "lg";
  href: string;
  value: number | null;
  chart: { name: string; value: number }[];
}
