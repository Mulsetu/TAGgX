"use server";

import "server-only";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { TENANT_HEADERS } from "@/lib/tenant";
import { requirePermission } from "@/lib/permissions/has-permission";
import {
  countCategoryFields,
  listAllCategoryFields,
  listCategories,
  listCategoryFields,
} from "./queries";
import {
  createCategory,
  createCategoryField,
  deleteCategory,
  deleteCategoryField,
  updateCategory,
  updateCategoryField,
} from "./mutations";
import {
  categoryFieldFormSchema,
  categoryFieldIdSchema,
  categoryFormSchema,
  MAX_FIELDS_PER_CATEGORY,
} from "./validation";
import type {
  CategoryField,
  CategoryFieldFormState,
  CategoryFormState,
  CategorySummary,
} from "./types";

const ADMIN_PATH = "/dashboard/administration/categories";
const FIELDS_PATH = "/dashboard/administration/fields";

export async function getCategoriesForAdmin(): Promise<CategorySummary[]> {
  return listCategories();
}

export async function getCategoryFieldsForAdmin(categoryId: string): Promise<CategoryField[]> {
  const parsed = categoryFieldIdSchema.safeParse(categoryId);
  if (!parsed.success) {
    return [];
  }
  return listCategoryFields(parsed.data);
}

/** All extra fields for the signed-in company — asset create/edit form. */
export async function getCategoryFieldsForAssetForm(): Promise<CategoryField[]> {
  return listAllCategoryFields();
}

export async function getCategoryFieldsForCategory(categoryId: string): Promise<CategoryField[]> {
  const parsed = categoryFieldIdSchema.safeParse(categoryId);
  if (!parsed.success) {
    return [];
  }
  return listCategoryFields(parsed.data);
}

function readCategoryFormData(formData: FormData) {
  return {
    name: formData.get("name"),
    description: formData.get("description"),
    parentCategoryId: formData.get("parentCategoryId"),
  };
}

function readFieldFormData(formData: FormData) {
  const options = String(formData.get("options") ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const requiredRaw = formData.get("required");

  return {
    categoryId: formData.get("categoryId"),
    label: formData.get("label"),
    fieldType: formData.get("fieldType"),
    required: requiredRaw === "true" || requiredRaw === "on",
    options,
    sortOrder: formData.get("sortOrder") || "0",
  };
}

export async function createCategoryAction(
  _prevState: CategoryFormState,
  formData: FormData,
): Promise<CategoryFormState> {
  if (!(await requirePermission("categories", "create"))) {
    return { error: "You don't have permission to create categories." };
  }

  const companyId = headers().get(TENANT_HEADERS.companyId);
  if (!companyId) {
    return { error: "Could not determine your company." };
  }

  const parsed = categoryFormSchema.safeParse(readCategoryFormData(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const result = await createCategory(companyId, parsed.data);
  if ("error" in result) {
    return { error: result.error };
  }

  revalidatePath(ADMIN_PATH);
  return { error: null };
}

export async function updateCategoryAction(
  id: string,
  _prevState: CategoryFormState,
  formData: FormData,
): Promise<CategoryFormState> {
  if (!(await requirePermission("categories", "edit"))) {
    return { error: "You don't have permission to edit categories." };
  }

  const parsed = categoryFormSchema.safeParse(readCategoryFormData(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const result = await updateCategory(id, parsed.data);
  if ("error" in result) {
    return { error: result.error };
  }

  revalidatePath(ADMIN_PATH);
  return { error: null };
}

export async function deleteCategoryAction(id: string): Promise<{ error: string | null }> {
  if (!(await requirePermission("categories", "delete"))) {
    return { error: "You don't have permission to delete categories." };
  }

  const result = await deleteCategory(id);
  revalidatePath(ADMIN_PATH);
  revalidatePath(FIELDS_PATH);
  return result;
}

export async function createCategoryFieldAction(
  _prevState: CategoryFieldFormState,
  formData: FormData,
): Promise<CategoryFieldFormState> {
  if (!(await requirePermission("categories", "create"))) {
    return { error: "You don't have permission to add fields." };
  }

  const companyId = headers().get(TENANT_HEADERS.companyId);
  if (!companyId) {
    return { error: "Could not determine your company." };
  }

  const parsed = categoryFieldFormSchema.safeParse(readFieldFormData(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const existing = await countCategoryFields(parsed.data.categoryId);
  if (existing >= MAX_FIELDS_PER_CATEGORY) {
    return { error: `A category can have at most ${MAX_FIELDS_PER_CATEGORY} extra fields.` };
  }

  const result = await createCategoryField(companyId, parsed.data);
  if ("error" in result) {
    return { error: result.error };
  }

  revalidatePath(FIELDS_PATH);
  revalidatePath("/assets");
  return { error: null };
}

export async function updateCategoryFieldAction(
  id: string,
  _prevState: CategoryFieldFormState,
  formData: FormData,
): Promise<CategoryFieldFormState> {
  if (!(await requirePermission("categories", "edit"))) {
    return { error: "You don't have permission to edit fields." };
  }

  const idParsed = categoryFieldIdSchema.safeParse(id);
  if (!idParsed.success) {
    return { error: "Field not found." };
  }

  const parsed = categoryFieldFormSchema.safeParse(readFieldFormData(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const result = await updateCategoryField(idParsed.data, {
    label: parsed.data.label,
    fieldType: parsed.data.fieldType,
    required: parsed.data.required,
    options: parsed.data.options,
    sortOrder: parsed.data.sortOrder,
  });
  if ("error" in result) {
    return { error: result.error };
  }

  revalidatePath(FIELDS_PATH);
  revalidatePath("/assets");
  return { error: null };
}

export async function deleteCategoryFieldAction(id: string): Promise<{ error: string | null }> {
  if (!(await requirePermission("categories", "delete"))) {
    return { error: "You don't have permission to delete fields." };
  }

  const idParsed = categoryFieldIdSchema.safeParse(id);
  if (!idParsed.success) {
    return { error: "Field not found." };
  }

  const result = await deleteCategoryField(idParsed.data);
  revalidatePath(FIELDS_PATH);
  revalidatePath("/assets");
  return result;
}
