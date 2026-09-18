import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CATEGORY_FIELD_TYPES } from "./types";
import type { CategoryField, CategoryFieldType, CategorySummary } from "./types";

interface CategoryRow {
  id: string;
  name: string;
  description: string | null;
  parent_category_id: string | null;
  code_prefix: string | null;
  is_active: boolean;
  default_status_id: string | null;
  default_condition_key: string | null;
  created_at: string;
  parent: { name: string } | null;
}

/** Every category for the caller's own company (RLS-scoped). */
export async function listCategories(): Promise<CategorySummary[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("asset_categories")
    .select("id, name, description, parent_category_id, code_prefix, is_active, default_status_id, default_condition_key, created_at, parent:asset_categories!parent_category_id(name)")
    .order("name")
    .returns<CategoryRow[]>();

  if (error || !data) {
    return [];
  }

  return data.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    parentCategoryId: row.parent_category_id,
    parentCategoryName: row.parent?.name ?? null,
    codePrefix: row.code_prefix,
    isActive: row.is_active,
    defaultStatusId: row.default_status_id,
    defaultConditionKey: row.default_condition_key,
    requiredDocumentKeys: [],
    createdAt: row.created_at,
  }));
}

interface CategoryFieldRow {
  id: string;
  category_id: string;
  label: string;
  key: string;
  field_type: string;
  required: boolean;
  options: unknown;
  sort_order: number;
}

function parseOptions(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
}

function isFieldType(value: string): value is CategoryFieldType {
  return (CATEGORY_FIELD_TYPES as readonly string[]).includes(value);
}

function rowToField(row: CategoryFieldRow): CategoryField | null {
  if (!isFieldType(row.field_type)) {
    return null;
  }
  return {
    id: row.id,
    categoryId: row.category_id,
    label: row.label,
    key: row.key,
    fieldType: row.field_type,
    required: row.required,
    options: parseOptions(row.options),
    sortOrder: row.sort_order,
  };
}

const FIELD_SELECT = "id, category_id, label, key, field_type, required, options, sort_order";

function mapFieldRows(data: CategoryFieldRow[] | null): CategoryField[] {
  if (!data) {
    return [];
  }
  return data.map(rowToField).filter((field): field is CategoryField => field !== null);
}

/** Every extra field defined on a category (RLS-scoped). */
export async function listCategoryFields(categoryId: string): Promise<CategoryField[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("category_fields")
    .select(FIELD_SELECT)
    .eq("category_id", categoryId)
    .order("sort_order")
    .order("label")
    .returns<CategoryFieldRow[]>();

  if (error) {
    return [];
  }

  return mapFieldRows(data);
}

/** Every extra field for the caller's company — for the asset create/edit form. */
export async function listAllCategoryFields(): Promise<CategoryField[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("category_fields")
    .select(FIELD_SELECT)
    .order("sort_order")
    .order("label")
    .returns<CategoryFieldRow[]>();

  if (error) {
    return [];
  }

  return mapFieldRows(data);
}

/**
 * Public tag page: scanners have no session, so this uses the admin
 * client the same way getPublicAssetById does. Scoped to one category.
 */
export async function listCategoryFieldsAdmin(categoryId: string): Promise<CategoryField[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("category_fields")
    .select(FIELD_SELECT)
    .eq("category_id", categoryId)
    .order("sort_order")
    .order("label")
    .returns<CategoryFieldRow[]>();

  if (error) {
    return [];
  }

  return mapFieldRows(data);
}

export async function countCategoryFields(categoryId: string): Promise<number> {
  const supabase = createClient();

  const { count, error } = await supabase
    .from("category_fields")
    .select("id", { count: "exact", head: true })
    .eq("category_id", categoryId);

  if (error) {
    return 0;
  }

  return count ?? 0;
}

export async function getCategoryCodePrefix(categoryId: string): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("asset_categories")
    .select("code_prefix")
    .eq("id", categoryId)
    .maybeSingle<{ code_prefix: string | null }>();
  return data?.code_prefix ?? null;
}

export async function listRequiredDocumentsByCategory(): Promise<Map<string, string[]>> {
  const supabase = createClient();
  const { data } = await supabase
    .from("category_required_documents")
    .select("category_id, document_type_key")
    .returns<{ category_id: string; document_type_key: string }[]>();
  const map = new Map<string, string[]>();
  for (const row of data ?? []) {
    const existing = map.get(row.category_id) ?? [];
    existing.push(row.document_type_key);
    map.set(row.category_id, existing);
  }
  return map;
}
