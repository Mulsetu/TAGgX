import { z } from "zod";
import { CATEGORY_FIELD_TYPES } from "./types";
import type { CategoryField, CustomFieldValue } from "./types";

const emptyToUndefined = (value: unknown) => (value === "" || value === null ? undefined : value);

export const categoryFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  description: z.preprocess(emptyToUndefined, z.string().trim().max(1000).optional()),
  parentCategoryId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
});

export type CategoryFormInput = z.infer<typeof categoryFormSchema>;

export const MAX_FIELDS_PER_CATEGORY = 40;

const selectOptionsSchema = z
  .array(z.string().trim().min(1).max(200))
  .max(30)
  .optional()
  .default([]);

export const categoryFieldFormSchema = z
  .object({
    categoryId: z.string().uuid("Category is required"),
    label: z.string().trim().min(1, "Label is required").max(200),
    fieldType: z.enum(CATEGORY_FIELD_TYPES),
    required: z.boolean().optional().default(false),
    options: selectOptionsSchema,
    sortOrder: z.coerce.number().int().min(0).max(9999).optional().default(0),
  })
  .refine((data) => data.fieldType !== "select" || data.options.length >= 2, {
    message: "Add at least two dropdown options.",
    path: ["options"],
  });

export type CategoryFieldFormInput = z.infer<typeof categoryFieldFormSchema>;

export const categoryFieldIdSchema = z.string().uuid();

export function slugifyFieldKey(label: string): string {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
  if (slug && /^[a-z]/.test(slug)) {
    return slug;
  }
  return `field_${slug || "1"}`.slice(0, 64);
}

function readRawCustomFields(formData: FormData): Record<string, string> {
  const raw: Record<string, string> = {};
  formData.forEach((value, name) => {
    if (!name.startsWith("customField.") || typeof value !== "string") {
      return;
    }
    const key = name.slice("customField.".length);
    if (key && /^[a-z][a-z0-9_]{0,63}$/.test(key)) {
      raw[key] = value;
    }
  });
  return raw;
}

/**
 * Keeps only keys defined on the category, coerces types, and reports
 * per-field errors. Unknown keys (e.g. leftover from a previous category)
 * are ignored here — the caller merges them back onto the stored jsonb.
 */
export function parseCategoryFieldValues(
  fields: CategoryField[],
  formData: FormData,
): { values: Record<string, CustomFieldValue>; fieldErrors: Record<string, string> } {
  const raw = readRawCustomFields(formData);
  const values: Record<string, CustomFieldValue> = {};
  const fieldErrors: Record<string, string> = Object.create(null);

  for (const field of fields) {
    const formKey = `custom_${field.key}`;
    const value = (raw[field.key] ?? "").trim();

    if (field.fieldType === "checkbox") {
      const checked = value === "true" || value === "on" || value === "1";
      if (field.required && !checked) {
        fieldErrors[formKey] = `${field.label} is required.`;
        continue;
      }
      values[field.key] = checked;
      continue;
    }

    if (!value) {
      if (field.required) {
        fieldErrors[formKey] = `${field.label} is required.`;
      }
      continue;
    }

    if (field.fieldType === "number") {
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) {
        fieldErrors[formKey] = `${field.label} must be a number.`;
        continue;
      }
      values[field.key] = parsed;
      continue;
    }

    if (field.fieldType === "date") {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        fieldErrors[formKey] = `${field.label} must be a valid date.`;
        continue;
      }
      values[field.key] = value;
      continue;
    }

    if (field.fieldType === "select") {
      if (!field.options.includes(value)) {
        fieldErrors[formKey] = `${field.label} is not a valid option.`;
        continue;
      }
      values[field.key] = value;
      continue;
    }

    if (value.length > 2000) {
      fieldErrors[formKey] = `${field.label} is too long.`;
      continue;
    }
    values[field.key] = value;
  }

  return { values, fieldErrors };
}

export function formatCustomFieldValue(field: CategoryField, value: CustomFieldValue | undefined): string | null {
  if (value === undefined || value === "") {
    return null;
  }
  if (field.fieldType === "checkbox") {
    return value === true ? "Yes" : "No";
  }
  return String(value);
}
