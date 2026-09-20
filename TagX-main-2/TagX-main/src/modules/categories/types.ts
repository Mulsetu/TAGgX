export interface CategorySummary {
  id: string;
  name: string;
  description: string | null;
  parentCategoryId: string | null;
  parentCategoryName: string | null;
  createdAt: string;
}

export interface CategoryOption {
  id: string;
  name: string;
}

export interface CategoryFormState {
  error: string | null;
}

export const CATEGORY_FIELD_TYPES = ["text", "number", "date", "select", "checkbox"] as const;
export type CategoryFieldType = (typeof CATEGORY_FIELD_TYPES)[number];

export const CATEGORY_FIELD_TYPE_LABELS: Record<CategoryFieldType, string> = {
  text: "Text",
  number: "Number",
  date: "Date",
  select: "Dropdown",
  checkbox: "Yes / No",
};

export interface CategoryField {
  id: string;
  categoryId: string;
  label: string;
  key: string;
  fieldType: CategoryFieldType;
  required: boolean;
  options: string[];
  sortOrder: number;
}

export interface CategoryFieldFormState {
  error: string | null;
}

export type CustomFieldValue = string | number | boolean;
