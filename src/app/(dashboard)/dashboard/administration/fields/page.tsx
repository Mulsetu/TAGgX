import Link from "next/link";
import { redirect } from "next/navigation";
import { requireModule } from "@/lib/permissions/features";
import { requirePermission } from "@/lib/permissions/has-permission";
import { ASSET_FIELD_KEYS, ASSET_FIELD_LABELS, parseAssetFieldConfig } from "@/lib/permissions/workspace-config";
import {
  getCategoriesForAdmin,
  getCategoryFieldsForAdmin,
  getCategoryFieldsForAssetForm,
} from "@/modules/categories/actions";
import { getWorkspaceSettingsForAdmin } from "@/modules/companies/actions";
import { BuiltinFieldList, type BuiltinFieldRow } from "./builtin-field-list";
import { CategoryFieldList } from "./field-list";
import { FieldPanels } from "./field-panels";

interface AssetFieldsPageProps {
  searchParams: { category?: string };
}

export default async function AssetFieldsPage({ searchParams }: AssetFieldsPageProps) {
  const [customOn, canCategories, canEditCategories, canViewSettings, canEditSettings] = await Promise.all([
    requireModule("custom_fields"),
    requirePermission("categories", "view"),
    requirePermission("categories", "edit"),
    requirePermission("settings", "view"),
    requirePermission("settings", "edit"),
  ]);
  const showExtra = customOn && canCategories;

  if (!showExtra && !canViewSettings) {
    redirect("/dashboard");
  }

  const [workspace, categories, allFields] = await Promise.all([
    canViewSettings ? getWorkspaceSettingsForAdmin() : Promise.resolve(null),
    showExtra ? getCategoriesForAdmin() : Promise.resolve([]),
    showExtra ? getCategoryFieldsForAssetForm() : Promise.resolve([]),
  ]);
  const selectedId =
    (typeof searchParams.category === "string" && categories.some((category) => category.id === searchParams.category)
      ? searchParams.category
      : categories[0]?.id) ?? null;
  const fields = selectedId ? await getCategoryFieldsForAdmin(selectedId) : [];
  const selected = categories.find((category) => category.id === selectedId) ?? null;
  const fieldCounts: Record<string, number> = {};
  for (const field of allFields) {
    fieldCounts[field.categoryId] = (fieldCounts[field.categoryId] ?? 0) + 1;
  }

  const extra = showExtra ? (
    categories.length === 0 ? (
      <p className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
        Add a{" "}
        <Link href="/dashboard/administration/categories" className="underline">
          category
        </Link>{" "}
        first, then define fields that only that category asks for.
      </p>
    ) : (
      <CategoryFieldList
        categories={categories}
        selected={selected}
        fields={fields}
        fieldCounts={fieldCounts}
        canEdit={canEditCategories}
      />
    )
  ) : null;

  const fieldConfig = parseAssetFieldConfig(workspace?.assetFieldConfig ?? null);
  const builtinRows: BuiltinFieldRow[] = [...ASSET_FIELD_KEYS]
    .sort((a, b) => fieldConfig[a].order - fieldConfig[b].order)
    .map((key) => ({
      id: key,
      defaultLabel: ASSET_FIELD_LABELS[key],
      label: fieldConfig[key].label,
      enabled: fieldConfig[key].enabled,
      required: fieldConfig[key].required,
    }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Asset fields</h1>
        <p className="text-sm text-muted-foreground">
          Category fields only appear on assets in one category. Built-in fields are on every asset.
        </p>
      </div>
      <FieldPanels
        extra={extra}
        builtin={workspace ? <BuiltinFieldList fields={builtinRows} canEdit={canEditSettings} /> : null}
      />
    </div>
  );
}
