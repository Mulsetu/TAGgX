import { z } from "zod";
import { MAINTENANCE_STATUSES } from "./types";

const emptyToUndefined = (value: unknown) => (value === "" || value === null ? undefined : value);

export const createTicketSchema = z.object({
  assetId: z.string().uuid("Choose an asset"),
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.preprocess(emptyToUndefined, z.string().trim().max(2000).optional()),
});

export const updateTicketSchema = z.object({
  status: z.enum(MAINTENANCE_STATUSES),
  assignedTo: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
});
