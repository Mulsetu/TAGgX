import { z } from "zod";
import { MAINTENANCE_STATUSES } from "./types";

const emptyToUndefined = (value: unknown) => (value === "" || value === null ? undefined : value);

export const createTicketSchema = z.object({
  assetId: z.string().uuid("Choose an asset"),
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.preprocess(emptyToUndefined, z.string().trim().max(2000).optional()),
  vendorId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  priority: z.enum(["low", "normal", "high", "emergency"]).optional().default("normal"),
  dueAt: z.preprocess(emptyToUndefined, z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
  typeKey: z.preprocess(emptyToUndefined, z.string().trim().max(64).optional()),
});

export const planFormSchema = z.object({
  assetId: z.string().uuid("Choose an asset"),
  name: z.string().trim().min(1).max(200),
  frequency: z.enum(["daily", "weekly", "monthly", "quarterly", "half_yearly", "yearly", "custom"]),
  intervalDays: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(3650).optional()),
  nextDueAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  vendorId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  assignedTo: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  checklist: z.preprocess(emptyToUndefined, z.string().trim().max(4000).optional()),
  estimatedCost: z.preprocess(emptyToUndefined, z.coerce.number().nonnegative().optional()),
  instructions: z.preprocess(emptyToUndefined, z.string().trim().max(4000).optional()),
});

export type PlanFormInput = z.infer<typeof planFormSchema>;

export const updateTicketSchema = z.object({
  status: z.enum(MAINTENANCE_STATUSES),
  assignedTo: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
});
