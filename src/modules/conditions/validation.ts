import { z } from "zod";

const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

export const conditionFormSchema = z.object({
  key: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Key is required")
    .max(64)
    .regex(/^[a-z][a-z0-9_]*$/, "Use a lowercase key like good or needs_inspection"),
  name: z.string().trim().min(1, "Name is required").max(100),
  color: z.preprocess(
    (value) => (value === "" || value === null ? undefined : value),
    z.string().trim().regex(HEX_COLOR_REGEX, "Enter a hex color like #4F46E5").optional(),
  ),
  sortOrder: z.coerce.number().int().min(0).max(9999),
  isActive: z.boolean().optional().default(true),
});

export type ConditionFormInput = z.infer<typeof conditionFormSchema>;

/** New order for a settings list — every id once, top to bottom. */
export const reorderSchema = z.array(z.string().uuid()).min(1).max(200);

/** Optional destination for assets still using the item being deleted. */
export const replacementSchema = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? undefined : value),
  z.string().uuid().optional(),
);
