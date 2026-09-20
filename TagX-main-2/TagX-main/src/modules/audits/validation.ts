import { z } from "zod";
import { ASSET_CONDITIONS } from "@/modules/assets/types";

const emptyToUndefined = (value: unknown) => (value === "" || value === null ? undefined : value);

export const createAuditSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  scheduledDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Date is required"),
  locationId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
});

export type CreateAuditInput = z.infer<typeof createAuditSchema>;

export const auditIdSchema = z.string().uuid();

export const auditListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
});

export const auditItemListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  tab: z.enum(["all", "unverified", "verified", "exceptions"]).default("all"),
});

export const auditScanLookupSchema = z.object({
  auditId: z.string().uuid(),
  query: z.string().trim().min(1, "Enter an asset code or scan the QR link").max(500),
});

export const recordAuditScanSchema = z.object({
  auditId: z.string().uuid(),
  assetId: z.string().uuid(),
  foundLocationId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  foundCondition: z.preprocess(emptyToUndefined, z.enum(ASSET_CONDITIONS).optional()),
  notes: z.preprocess(emptyToUndefined, z.string().trim().max(2000).optional()),
});

export type RecordAuditScanInput = z.infer<typeof recordAuditScanSchema>;

export const resolveAuditItemSchema = z.object({
  auditId: z.string().uuid(),
  itemId: z.string().uuid(),
  resolutionNotes: z.string().trim().min(1, "Add a resolution note").max(2000),
});

export const markMissingSchema = z.object({
  auditId: z.string().uuid(),
  itemId: z.string().uuid(),
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Accepts a raw UUID, /tag/{id} or /assets/{id} URL, or an asset code. */
export function parseAssetScanQuery(raw: string): { assetId: string | null; assetCode: string | null } {
  const trimmed = raw.trim();
  const fromPath = trimmed.match(/\/(?:tag|assets)\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
  const candidate = fromPath?.[1] ?? trimmed;
  if (UUID_RE.test(candidate)) {
    return { assetId: candidate.toLowerCase(), assetCode: null };
  }
  return { assetId: null, assetCode: trimmed };
}
