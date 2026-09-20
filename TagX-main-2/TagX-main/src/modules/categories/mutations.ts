import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { CategoryFieldFormInput, CategoryFormInput } from "./validation";
import { slugifyFieldKey } from "./validation";

export type CategoryMutationResult = { id: string } | { error: string };

function friendlyError(code: string | undefined): string {
  if (code === "23505") return "A category with this name already exists.";
  return "Could not save the category.";
}

export async function createCategory(
  companyId: string,
  input: CategoryFormInput,
): Promise<CategoryMutationResult> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("asset_categories")
    .insert({
      company_id: companyId,
      name: input.name,
      description: input.description ?? null,
      parent_category_id: input.parentCategoryId ?? null,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    return { error: friendlyError(error?.code) };
  }

  return { id: data.id };
}

export async function updateCategory(
  id: string,
  input: CategoryFormInput,
): Promise<CategoryMutationResult> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("asset_categories")
    .update({
      name: input.name,
      description: input.description ?? null,
      parent_category_id: input.parentCategoryId ?? null,
    })
    .eq("id", id)
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    return { error: friendlyError(error?.code) };
  }

  return { id: data.id };
}

export async function deleteCategory(id: string): Promise<{ error: string | null }> {
  const supabase = createClient();

  const { error } = await supabase.from("asset_categories").delete().eq("id", id);

  if (error) {
    // assets.category_id -> asset_categories(id) is ON DELETE SET NULL, so
    // a delete failure here is something else (e.g. a child category still
    // pointing at it via parent_category_id, which is ON DELETE SET NULL
    // too — most likely just a transient/db error).
    return { error: "Could not delete the category." };
  }

  return { error: null };
}

export type CategoryFieldMutationResult = { id: string } | { error: string };

function fieldFriendlyError(code: string | undefined): string {
  if (code === "23505") return "A field with this name already exists on this category.";
  return "Could not save the field.";
}

async function nextAvailableKey(categoryId: string, baseKey: string): Promise<string> {
  const supabase = createClient();
  const { data } = await supabase
    .from("category_fields")
    .select("key")
    .eq("category_id", categoryId)
    .returns<{ key: string }[]>();

  const taken = new Set((data ?? []).map((row) => row.key));
  if (!taken.has(baseKey)) {
    return baseKey;
  }

  for (let n = 2; n < 100; n += 1) {
    const candidate = `${baseKey}_${n}`.slice(0, 64);
    if (!taken.has(candidate)) {
      return candidate;
    }
  }

  return `${baseKey}_${Date.now()}`.slice(0, 64);
}

export async function createCategoryField(
  companyId: string,
  input: CategoryFieldFormInput,
): Promise<CategoryFieldMutationResult> {
  const supabase = createClient();

  const { data: category } = await supabase
    .from("asset_categories")
    .select("id")
    .eq("id", input.categoryId)
    .maybeSingle<{ id: string }>();

  if (!category) {
    return { error: "Category not found." };
  }

  const key = await nextAvailableKey(input.categoryId, slugifyFieldKey(input.label));

  const { data, error } = await supabase
    .from("category_fields")
    .insert({
      company_id: companyId,
      category_id: input.categoryId,
      label: input.label,
      key,
      field_type: input.fieldType,
      required: input.required,
      options: input.fieldType === "select" ? input.options : [],
      sort_order: input.sortOrder,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    return { error: fieldFriendlyError(error?.code) };
  }

  return { id: data.id };
}

export async function updateCategoryField(
  id: string,
  input: Omit<CategoryFieldFormInput, "categoryId">,
): Promise<CategoryFieldMutationResult> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("category_fields")
    .update({
      label: input.label,
      field_type: input.fieldType,
      required: input.required,
      options: input.fieldType === "select" ? input.options : [],
      sort_order: input.sortOrder,
    })
    .eq("id", id)
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    return { error: fieldFriendlyError(error?.code) };
  }

  return { id: data.id };
}

export async function deleteCategoryField(id: string): Promise<{ error: string | null }> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("category_fields")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error) {
    return { error: "Could not delete the field." };
  }
  if (!data) {
    return { error: "Field not found." };
  }

  return { error: null };
}
