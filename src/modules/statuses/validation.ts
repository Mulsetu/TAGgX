import { z } from "zod";

export const statusFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  sortOrder: z.coerce.number().int().min(0).max(9999),
  color: z.preprocess(
    (value) => (value === "" || value === null ? undefined : value),
    z
      .string()
      .trim()
      .regex(/^#[0-9a-fA-F]{6}$/, "Enter a hex color like #4F46E5")
      .optional(),
  ),
  isFinal: z.boolean().optional().default(false),
  allowsAssignment: z.boolean().optional().default(true),
});

export type StatusFormInput = z.infer<typeof statusFormSchema>;
