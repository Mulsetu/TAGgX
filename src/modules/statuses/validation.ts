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

/** New order for a settings list — every id once, top to bottom. */
export const reorderSchema = z.array(z.string().uuid()).min(1).max(200);

/** Optional destination for assets still using the item being deleted. */
export const replacementSchema = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? undefined : value),
  z.string().uuid().optional(),
);
