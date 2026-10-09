"use server";

import "server-only";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { TENANT_HEADERS } from "@/lib/tenant";
import { requireModule } from "@/lib/permissions/features";
import { requirePermission } from "@/lib/permissions/has-permission";
import { clientIpFromHeaders, consumeRateLimit } from "@/lib/rate-limit";
import { writeAuditLog } from "@/lib/audit-log";
import { TENANT_READ_ONLY_MESSAGE, requireWritableTenant } from "@/lib/permissions/tenant-access";
import {
  countAssetsPerCategory,
  countCategoryFields,
  getCategoryCodePrefix,
  listAllCategoryFields,
  listCategories,
  listCategoryFields,
  listRequiredDocumentsByCategory,
} from "./queries";
import {
  createCategory,
  createCategoryField,
  deleteCategory,
  deleteCategoryField,
  reassignCategoryAssets,
  replaceRequiredDocuments,
  updateCategory,
  updateCategoryField,
} from "./mutations";
import {
  categoryFieldFormSchema,
  categoryFieldIdSchema,
  categoryFormSchema,
  MAX_FIELDS_PER_CATEGORY,
  replacementSchema,
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
  if (!(await requirePermission("categories", "view"))) {
    return [];
  }
  const [categories, required] = await Promise.all([listCategories(), listRequiredDocumentsByCategory()]);
  return categories.map((category) => ({
    ...category,
    requiredDocumentKeys: required.get(category.id) ?? [],
  }));
}

export async function getCategoryFieldsForAdmin(categoryId: string): Promise<CategoryField[]> {
  if (!(await requireModule("custom_fields")) || !(await requirePermission("categories", "view"))) {
    return [];
  }
  const parsed = categoryFieldIdSchema.safeParse(categoryId);
  if (!parsed.success) {
    return [];
  }
  return listCategoryFields(parsed.data);
}

export async function getCategoryPrefixForAsset(categoryId: string): Promise<string | null> {
  const parsed = categoryFieldIdSchema.safeParse(categoryId);
  if (!parsed.success) {
    return null;
  }
  return getCategoryCodePrefix(parsed.data);
}
export async function getCategoryFieldsForAssetForm(): Promise<CategoryField[]> {
  if (!(await requireModule("custom_fields"))) {
    return [];
  }
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
    codePrefix: formData.get("codePrefix"),
    isActive: formData.get("isActive") === "on" || formData.get("isActive") === "true",
    defaultStatusId: formData.get("defaultStatusId"),
    defaultConditionKey: formData.get("defaultConditionKey"),
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
  if (!(await requireWritableTenant())) {
    return { error: TENANT_READ_ONLY_MESSAGE };
  }
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
  const requiredKeys = formData.getAll("requiredDoc").map(String).filter(Boolean);
  await replaceRequiredDocuments(companyId, result.id, requiredKeys);

  revalidatePath(ADMIN_PATH);
  return { error: null };
}

export async function updateCategoryAction(
  id: string,
  _prevState: CategoryFormState,
  formData: FormData,
): Promise<CategoryFormState> {
  if (!(await requireWritableTenant())) {
    return { error: TENANT_READ_ONLY_MESSAGE };
  }
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
  const companyId = headers().get(TENANT_HEADERS.companyId);
  if (companyId) {
    const requiredKeys = formData.getAll("requiredDoc").map(String).filter(Boolean);
    await replaceRequiredDocuments(companyId, id, requiredKeys);
  }

  revalidatePath(ADMIN_PATH);
  return { error: null };
}

/** Live assets per category — drives the counts and safe delete. */
export async function getCategoryUsageForAdmin(): Promise<Record<string, number>> {
  if (!(await requirePermission("categories", "view"))) {
    return {};
  }
  const categories = await listCategories();
  return countAssetsPerCategory(categories.map((category) => category.id));
}

/**
 * Deletes a category. assets.category_id is ON DELETE SET NULL, so without a
 * replacement its assets would silently become uncategorized — pass
 * `replacementId` to move them, or leave it out to deliberately uncategorize.
 */
export async function deleteCategoryAction(id: string, replacementId?: string): Promise<{ error: string | null }> {
  if (!(await requireWritableTenant())) {
    return { error: TENANT_READ_ONLY_MESSAGE };
  }
  if (!(await requirePermission("categories", "delete"))) {
    return { error: "You don't have permission to delete categories." };
  }
  if (!consumeRateLimit(`setup-delete:${clientIpFromHeaders(headers())}`, 30, 60_000)) {
    return { error: "Too many requests. Wait a minute and try again." };
  }
  const replacement = replacementSchema.safeParse(replacementId);
  if (!replacement.success || replacement.data === id) {
    return { error: "Choose a different category to move the assets to." };
  }
  if (replacement.data) {
    if (!(await requirePermission("assets", "edit"))) {
      return { error: "You need asset edit access to move assets to another category." };
    }
    const categories = await listCategories();
    if (!categories.some((category) => category.id === replacement.data)) {
      return { error: "That category no longer exists." };
    }
    const moved = await reassignCategoryAssets(id, replacement.data);
    if (moved.error) {
      return moved;
    }
  }

  const result = await deleteCategory(id);
  if (!result.error) {
    await writeAuditLog({ action: "category.deleted", entityType: "asset_category", entityId: id, newValues: { movedTo: replacement.data ?? null } });
  }
  revalidatePath(ADMIN_PATH);
  revalidatePath(FIELDS_PATH);
  return result;
}

export async function createCategoryFieldAction(
  _prevState: CategoryFieldFormState,
  formData: FormData,
): Promise<CategoryFieldFormState> {
  if (!(await requireWritableTenant())) {
    return { error: TENANT_READ_ONLY_MESSAGE };
  }
  if (!(await requireModule("custom_fields")) || !(await requirePermission("categories", "create"))) {
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
  if (!(await requireWritableTenant())) {
    return { error: TENANT_READ_ONLY_MESSAGE };
  }
  if (!(await requireModule("custom_fields")) || !(await requirePermission("categories", "edit"))) {
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
  if (!(await requireWritableTenant())) {
    return { error: TENANT_READ_ONLY_MESSAGE };
  }
  if (!(await requireModule("custom_fields")) || !(await requirePermission("categories", "delete"))) {
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
