import { z } from "zod";
import { ASSET_CRITICALITIES, ASSET_LIST_SORTS, OWNERSHIP_TYPES } from "./types";

// FormData gives every field as a string (or null when absent). These
// helpers normalize "" to "not provided" before the real check runs.
const emptyToUndefined = (value: unknown) => (value === "" || value === null ? undefined : value);

const optionalString = (max: number) =>
  z.preprocess(emptyToUndefined, z.string().trim().max(max).optional());

const optionalUuid = () => z.preprocess(emptyToUndefined, z.string().uuid().optional());

const optionalDate = () =>
  z.preprocess(emptyToUndefined, z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date").optional());

export const assetFormSchema = z
  .object({
    // Basic Info
    name: z.string().trim().min(1, "Name is required").max(200),
    imageUrl: optionalString(2048),
    // Omitted/blank => auto-generate in mutations.ts using
    // company_settings.asset_code_format.
    assetCode: optionalString(100),
    categoryId: z.string().uuid("Category is required"),
    locationId: z.string().uuid("Location is required"),
    cwipInvoiceId: optionalString(100),
    statusId: z.string().uuid("Status is required"),

    // Additional Info
    condition: z.preprocess(emptyToUndefined, z.string().trim().regex(/^[a-z][a-z0-9_]{0,63}$/).optional()),
    brand: optionalString(200),
    model: optionalString(200),
    linkedAssetId: optionalUuid(),
    description: optionalString(2000),
    serialNumber: optionalString(200),

    // Purchase Info
    vendor: optionalString(200),
    vendorId: optionalUuid(),
    poNumber: optionalString(100),
    invoiceDate: optionalDate(),
    invoiceNumber: optionalString(100),
    purchaseDate: optionalDate(),
    purchasePrice: z.preprocess(emptyToUndefined, z.coerce.number().nonnegative().optional()),
    ownershipType: z.enum(OWNERSHIP_TYPES),
    partnerName: optionalString(200),
    // Allotment block
    allottedTo: optionalUuid(),
    allotmentDate: optionalDate(),
    // Warranty / AMC / Insurance block
    warrantyStartDate: optionalDate(),
    warrantyEndDate: optionalDate(),
    amcProvider: optionalString(200),
    amcStartDate: optionalDate(),
    amcEndDate: optionalDate(),
    insuranceProvider: optionalString(200),
    insurancePolicyNumber: optionalString(200),
    insuranceExpiryDate: optionalDate(),
    criticality: z.preprocess(
      emptyToUndefined,
      z.enum(ASSET_CRITICALITIES).optional(),
    ),
    usefulLifeYears: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(100).optional()),
    currentBookValue: z.preprocess(emptyToUndefined, z.coerce.number().nonnegative().optional()),
    residualValue: z.preprocess(emptyToUndefined, z.coerce.number().nonnegative().optional()),
    notes: optionalString(4000),
    department: optionalString(200),
    tags: optionalString(500),
    parentAssetId: optionalUuid(),
  })
  .refine((data) => data.ownershipType !== "partner" || Boolean(data.partnerName), {
    message: "Partner name is required when ownership is Partner",
    path: ["partnerName"],
  });

export type AssetFormInput = z.infer<typeof assetFormSchema>;

export const assetListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  q: z.preprocess(emptyToUndefined, z.string().trim().max(100).optional()),
  categoryId: optionalUuid(),
  locationId: optionalUuid(),
  statusId: optionalUuid(),
  vendorId: optionalUuid(),
  allottedTo: optionalUuid(),
  condition: z.preprocess(emptyToUndefined, z.string().trim().regex(/^[a-z][a-z0-9_]{0,63}$/).optional()),
  warranty: z.preprocess(emptyToUndefined, z.enum(["active", "expired", "none"]).optional()),
  amc: z.preprocess(emptyToUndefined, z.enum(["active", "expired", "none"]).optional()),
  documentExpiry: z.preprocess(emptyToUndefined, z.enum(["expired", "expiring", "none"]).optional()),
  sort: z.preprocess(emptyToUndefined, z.enum(ASSET_LIST_SORTS).optional()),
  sortDir: z.preprocess(emptyToUndefined, z.enum(["asc", "desc"]).optional()),
  includeArchived: z.preprocess((value) => value === "1" || value === "true" || value === true, z.boolean().optional()),
});

export const publicAssetIdSchema = z.string().uuid();

export const publicAssetReportSchema = z.object({
  assetId: z.string().uuid(),
  name: z.string().trim().min(1, "Name is required").max(200),
  email: z.string().trim().email("Enter a valid email").max(320),
  message: z.string().trim().min(1, "Describe the issue").max(2000),
});
