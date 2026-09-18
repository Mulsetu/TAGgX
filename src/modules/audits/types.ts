import type { AssetCondition } from "@/modules/assets/types";

export const AUDIT_STATUSES = ["draft", "active", "completed"] as const;
export type AuditStatus = (typeof AUDIT_STATUSES)[number];

export const AUDIT_ITEM_STATUSES = ["unverified", "verified", "exception"] as const;
export type AuditItemStatus = (typeof AUDIT_ITEM_STATUSES)[number];

export const AUDIT_EXCEPTION_TYPES = [
  "missing",
  "wrong_location",
  "condition_mismatch",
  "wrong_custodian",
  "qr_damaged",
  "unreadable_qr",
  "not_registered",
  "duplicate",
  "document_missing",
  "damaged",
  "other",
] as const;
export type AuditExceptionType = string;

export function auditExceptionLabel(type: AuditExceptionType): string {
  return type.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export const AUDIT_STATUS_LABELS: Record<AuditStatus, string> = {
  draft: "Draft",
  active: "Active",
  completed: "Completed",
};

export const AUDIT_ITEM_STATUS_LABELS: Record<AuditItemStatus, string> = {
  unverified: "Unverified",
  verified: "Verified",
  exception: "Exception",
};

export interface AuditLocationOption {
  id: string;
  name: string;
}

export interface AuditListItem {
  id: string;
  name: string;
  scheduledDate: string;
  locationName: string | null;
  status: AuditStatus;
  totalItems: number;
  verifiedCount: number;
  exceptionCount: number;
  unverifiedCount: number;
  progressPercent: number;
  createdAt: string;
}

export interface AuditListResult {
  items: AuditListItem[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface AuditDetail {
  id: string;
  name: string;
  scheduledDate: string;
  locationId: string | null;
  locationName: string | null;
  status: AuditStatus;
  createdByName: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  totalItems: number;
  verifiedCount: number;
  exceptionCount: number;
  unverifiedCount: number;
  progressPercent: number;
  unresolvedExceptionCount: number;
  requirePhotoOnException: boolean;
  requireRemarkOnException: boolean;
}

export interface AuditItem {
  id: string;
  assetId: string;
  assetName: string;
  assetCode: string;
  expectedLocationId: string | null;
  expectedLocationName: string | null;
  expectedCondition: AssetCondition | null;
  status: AuditItemStatus;
  exceptionTypes: AuditExceptionType[];
  foundLocationId: string | null;
  foundLocationName: string | null;
  foundCondition: AssetCondition | null;
  notes: string | null;
  scannedAt: string | null;
  resolved: boolean;
  resolutionNotes: string | null;
  exceptionPhotoPath: string | null;
}

export interface AuditItemListResult {
  items: AuditItem[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface AuditItemFilters {
  tab: "all" | "unverified" | "verified" | "exceptions";
  exceptionType?: string;
}

export interface AuditScanMatch {
  item: AuditItem;
  auditId: string;
  auditName: string;
}

export interface AuditTagContext {
  auditId: string;
  auditName: string;
  item: AuditItem;
  locations: AuditLocationOption[];
  conditions: { key: string; name: string }[];
  exceptionTypes: { key: string; name: string }[];
}

export interface AuditFormState {
  error: string | null;
  id?: string;
}

export interface AuditScanState {
  error: string | null;
  success?: string;
}

export interface AuditExportResult {
  csv: string;
  filename: string;
}
