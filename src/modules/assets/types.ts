import type { CategoryField, CustomFieldValue } from "@/modules/categories/types";
import type { AssetFieldConfig, AssetFieldKey } from "@/lib/permissions/workspace-config";

export interface CategoryAssetCount {
  categoryId: string | null;
  categoryName: string;
  count: number;
}

export interface LocationAssetCount {
  locationId: string | null;
  locationName: string;
  count: number;
}

export interface StatusAssetCount {
  statusId: string;
  statusName: string;
  count: number;
}

export const ASSET_CONDITIONS = ["new", "good", "fair", "poor"] as const;
export type AssetCondition = string;

export const ASSET_CRITICALITIES = ["low", "medium", "high", "critical"] as const;
export type AssetCriticality = (typeof ASSET_CRITICALITIES)[number];

export const ASSET_LIST_SORTS = ["updated", "created", "name", "code", "purchase"] as const;
export type AssetListSort = (typeof ASSET_LIST_SORTS)[number];

export interface ConditionOption {
  key: string;
  name: string;
}

export const OWNERSHIP_TYPES = ["owned", "partner"] as const;
export type OwnershipType = (typeof OWNERSHIP_TYPES)[number];

export interface AssetOption {
  id: string;
  name: string;
}

/** Options for the form's dropdown/picker fields. */
export interface AssetFormOptions {
  categories: AssetOption[];
  locations: AssetOption[];
  statuses: AssetOption[];
  users: AssetOption[];
  linkableAssets: AssetOption[];
  categoryFields: CategoryField[];
  conditions: ConditionOption[];
  vendors: AssetOption[];
  fieldConfig: AssetFieldConfig;
  departments: string[];
  disposalMethods: string[];
}

/** Row shape for the /assets list table. */
export interface AssetListItem {
  id: string;
  name: string;
  assetCode: string;
  categoryName: string | null;
  locationName: string | null;
  statusId: string;
  statusName: string;
  /** Hex colour set on the status in Company setup, if any. */
  statusColor: string | null;
  imageUrl: string | null;
  serialNumber: string | null;
  vendorName: string | null;
  allottedToName: string | null;
  condition: AssetCondition | null;
  updatedAt: string;
}

/** Compact row for the company dashboard's recent-assets table. */
export interface RecentAsset {
  id: string;
  name: string;
  assetCode: string;
  categoryName: string | null;
  locationName: string | null;
  statusName: string;
  /** Hex colour set on the status in Company setup, if any. */
  statusColor: string | null;
  imageUrl: string | null;
  allottedToName: string | null;
  updatedAt: string;
}

export interface AssetListFilters {
  q?: string;
  categoryId?: string;
  locationId?: string;
  statusId?: string;
  condition?: string;
  vendorId?: string;
  allottedTo?: string;
  warranty?: "active" | "expired" | "none";
  amc?: "active" | "expired" | "none";
  documentExpiry?: "expired" | "expiring" | "none";
  sort?: AssetListSort;
  sortDir?: "asc" | "desc";
  includeArchived?: boolean;
}

export interface AssetListResult {
  items: AssetListItem[];
  totalCount: number;
  page: number;
  pageSize: number;
}

/** Full detail shape for /assets/[id] and the edit form. */
export interface Asset {
  id: string;
  companyId: string;

  // Basic Info
  name: string;
  imageUrl: string | null;
  assetCode: string;
  categoryId: string | null;
  categoryName: string | null;
  locationId: string | null;
  locationName: string | null;
  cwipInvoiceId: string | null;
  statusId: string;
  statusName: string;

  // Additional Info
  condition: AssetCondition | null;
  brand: string | null;
  model: string | null;
  linkedAssetId: string | null;
  linkedAssetName: string | null;
  description: string | null;
  serialNumber: string | null;

  // Purchase Info
  vendor: string | null;
  vendorId: string | null;
  poNumber: string | null;
  invoiceDate: string | null;
  invoiceNumber: string | null;
  purchaseDate: string | null;
  purchasePrice: number | null;
  ownershipType: OwnershipType;
  partnerName: string | null;
  allottedTo: string | null;
  allottedToName: string | null;
  allotmentDate: string | null;
  warrantyStartDate: string | null;
  warrantyEndDate: string | null;
  amcProvider: string | null;
  amcStartDate: string | null;
  amcEndDate: string | null;
  insuranceProvider: string | null;
  insurancePolicyNumber: string | null;
  insuranceExpiryDate: string | null;

  criticality: AssetCriticality | null;
  usefulLifeYears: number | null;
  currentBookValue: number | null;
  residualValue: number | null;
  notes: string | null;
  department: string | null;
  tags: string[];
  archivedAt: string | null;
  deletedAt: string | null;
  parentAssetId: string | null;
  parentAssetName: string | null;

  createdAt: string;
  updatedAt: string;
  qrGeneratedAt: string | null;
  customFields: Record<string, CustomFieldValue>;
}

export interface AssetFormState {
  error: string | null;
  fieldErrors?: Record<string, string>;
}

export interface DeleteAssetState {
  error: string | null;
}

/** Public QR-scan view: identification + status only, no financials. */
export interface PublicAsset {
  id: string;
  name: string;
  imageUrl: string | null;
  assetCode: string;
  categoryName: string | null;
  locationName: string | null;
  statusName: string;
  condition: AssetCondition | null;
  brand: string | null;
  model: string | null;
  description: string | null;
  serialNumber: string | null;
  tags: string[];
  customFields: { label: string; value: string }[];
  company: {
    id: string;
    slug: string;
    name: string;
    logoUrl: string | null;
    primaryColor: string | null;
    secondaryColor: string | null;
  };
}

export type TagPageViewer =
  | { kind: "anonymous" }
  | { kind: "superadmin" }
  | { kind: "member"; canOpenAsset: boolean }
  | { kind: "other" };

export interface PublicAssetReportState {
  error: string | null;
  success?: boolean;
}

export type DocumentExpiryStatus = "none" | "ok" | "expiring" | "expired";

export interface AssetAttachment {
  id: string;
  fileName: string;
  fileUrl: string;
  filePath: string;
  fileSizeBytes: number;
  mimeType: string;
  documentType: string | null;
  expiresAt: string | null;
  expiryStatus: DocumentExpiryStatus;
  createdAt: string;
}

export interface DocumentTypeOption {
  key: string;
  name: string;
}

export type WarrantyReminderReason = "warranty" | "amc" | "insurance";

export interface UpcomingWarrantyReminder {
  assetId: string;
  companyId: string;
  name: string;
  assetCode: string;
  reason: WarrantyReminderReason;
  dueDate: string;
}

export interface AssetLocationMove {
  id: string;
  fromLocationPath: string | null;
  toLocationPath: string | null;
  movedAt: string;
  movedByName: string | null;
  notes: string | null;
}

/** Most labels one bulk QR PDF can hold. */
export const QR_LABEL_LIMIT = 1000;

export interface QrLabel {
  id: string;
  name: string;
  assetCode: string;
}

export interface QrLabelsState {
  error: string | null;
  labels?: QrLabel[];
  /** True when more assets matched than QR_LABEL_LIMIT; only the first ones were returned. */
  truncated?: boolean;
}

// ---------------------------------------------------------------------
// CSV import
// ---------------------------------------------------------------------

/** One column the import sample can contain. */
export interface AssetImportColumn {
  column: string;
  label: string;
  example: string;
  hint?: string;
  required: boolean;
}

export interface AssetImportCategoryColumns {
  categoryName: string;
  columns: AssetImportColumn[];
}

/** What the import picker offers: always-included columns, optional asset fields, and category fields. */
export interface AssetImportTemplate {
  core: AssetImportColumn[];
  fields: AssetImportColumn[];
  categories: AssetImportCategoryColumns[];
}

export interface AssetImportState {
  error: string | null;
  result?: { successCount: number; errorCount: number; errorCsv?: string };
}

/** Category custom fields travel as `custom_<field key>` columns. */
export const CUSTOM_IMPORT_PREFIX = "custom_";

/**
 * CSV column for each built-in asset field. Reference fields are matched by
 * something a person can type: vendor name, user email, asset code.
 */
export const ASSET_IMPORT_COLUMNS: Record<AssetFieldKey, { column: string; example: string; hint?: string }> = {
  serialNumber: { column: "serial_number", example: "SN-001" },
  brand: { column: "brand", example: "Dell" },
  model: { column: "model", example: "Latitude 5440" },
  description: { column: "description", example: "14-inch laptop" },
  condition: { column: "condition", example: "good", hint: "Condition name or key" },
  linkedAssetId: { column: "linked_asset_code", example: "", hint: "Code of a related asset" },
  parentAssetId: { column: "parent_asset_code", example: "", hint: "Code of the parent asset" },
  cwipInvoiceId: { column: "cwip_invoice_id", example: "" },
  department: { column: "department", example: "IT" },
  tags: { column: "tags", example: "laptop, office" },
  criticality: { column: "criticality", example: "medium", hint: "low, medium, high or critical" },
  notes: { column: "notes", example: "" },
  vendorId: { column: "vendor", example: "", hint: "Vendor name" },
  poNumber: { column: "po_number", example: "PO-1001" },
  invoiceDate: { column: "invoice_date", example: "2026-01-15", hint: "YYYY-MM-DD" },
  invoiceNumber: { column: "invoice_number", example: "INV-1001" },
  purchaseDate: { column: "purchase_date", example: "2026-01-15", hint: "YYYY-MM-DD" },
  purchasePrice: { column: "purchase_price", example: "55000" },
  usefulLifeYears: { column: "useful_life_years", example: "5" },
  currentBookValue: { column: "current_book_value", example: "50000" },
  residualValue: { column: "residual_value", example: "5000" },
  ownershipType: { column: "ownership", example: "owned", hint: "owned or partner (then fill partner_name)" },
  allottedTo: { column: "allotted_to_email", example: "", hint: "Email of a user in this workspace" },
  allotmentDate: { column: "allotment_date", example: "2026-01-20", hint: "YYYY-MM-DD" },
  warrantyStartDate: { column: "warranty_start_date", example: "2026-01-15", hint: "YYYY-MM-DD" },
  warrantyEndDate: { column: "warranty_end_date", example: "2029-01-14", hint: "YYYY-MM-DD" },
  amcProvider: { column: "amc_provider", example: "" },
  amcStartDate: { column: "amc_start_date", example: "", hint: "YYYY-MM-DD" },
  amcEndDate: { column: "amc_end_date", example: "", hint: "YYYY-MM-DD" },
  insuranceProvider: { column: "insurance_provider", example: "" },
  insurancePolicyNumber: { column: "insurance_policy_number", example: "" },
  insuranceExpiryDate: { column: "insurance_expiry_date", example: "", hint: "YYYY-MM-DD" },
};

export const PARTNER_NAME_IMPORT_COLUMN = "partner_name";

/** Most rows one import file may contain. */
export const ASSET_IMPORT_ROW_LIMIT = 500;
