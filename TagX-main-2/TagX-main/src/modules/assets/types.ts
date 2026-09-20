import type { CategoryField, CustomFieldValue } from "@/modules/categories/types";

export interface CategoryAssetCount {
  categoryId: string | null;
  categoryName: string;
  count: number;
}

export interface StatusAssetCount {
  statusId: string;
  statusName: string;
  count: number;
}

export const ASSET_CONDITIONS = ["new", "good", "fair", "poor"] as const;
export type AssetCondition = (typeof ASSET_CONDITIONS)[number];

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
  imageUrl: string | null;
}

export interface AssetListFilters {
  categoryId?: string;
  locationId?: string;
  statusId?: string;
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

export interface AssetAttachment {
  id: string;
  fileName: string;
  fileUrl: string;
  fileSizeBytes: number;
  mimeType: string;
  createdAt: string;
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
