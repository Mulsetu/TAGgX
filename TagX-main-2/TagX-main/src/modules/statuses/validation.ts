import { z } from "zod";

export const statusFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  sortOrder: z.coerce.number().int().min(0).max(9999),
});

export type StatusFormInput = z.infer<typeof statusFormSchema>;
