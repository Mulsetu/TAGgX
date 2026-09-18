import { z } from "zod";

const emptyToUndefined = (value: unknown) => (value === "" || value === null ? undefined : value);

export const handoverSchema = z.object({
  assetId: z.string().uuid(),
  toUserId: z.string().uuid("Choose who receives the asset"),
  handedOverAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  accessories: z.preprocess(emptyToUndefined, z.string().trim().max(2000).optional()),
  notes: z.preprocess(emptyToUndefined, z.string().trim().max(2000).optional()),
});

export const returnSchema = z.object({
  assetId: z.string().uuid(),
  returnedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  conditionKey: z.preprocess(emptyToUndefined, z.string().trim().max(64).optional()),
  damageRemarks: z.preprocess(emptyToUndefined, z.string().trim().max(2000).optional()),
  missingAccessories: z.preprocess(emptyToUndefined, z.string().trim().max(2000).optional()),
});

export const transferSchema = z.object({
  assetId: z.string().uuid(),
  toUserId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  toLocationId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  transferredAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.preprocess(emptyToUndefined, z.string().trim().max(2000).optional()),
});

export const disposeSchema = z.object({
  assetId: z.string().uuid(),
  statusId: z.string().uuid("Choose a final status"),
  disposedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().trim().min(1).max(2000),
  value: z.preprocess(emptyToUndefined, z.coerce.number().nonnegative().optional()),
});

export type HandoverInput = z.infer<typeof handoverSchema>;
export type ReturnInput = z.infer<typeof returnSchema>;
export type TransferInput = z.infer<typeof transferSchema>;
