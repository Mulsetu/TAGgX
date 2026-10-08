import Link from "next/link";
import { redirect } from "next/navigation";
import { requireModule } from "@/lib/permissions/features";
import { requirePermission } from "@/lib/permissions/has-permission";
import { getCategoriesForAdmin, getCategoryFieldsForAdmin } from "@/modules/categories/actions";
import { getWorkspaceSettingsForAdmin } from "@/modules/companies/actions";
import { BuiltinFieldsForm } from "../settings/workspace-form";
import { CategoryFieldList } from "./field-list";
import { FieldPanels } from "./field-panels";

interface AssetFieldsPageProps {
  searchParams: { category?: string };
}

export default async function AssetFieldsPage({ searchParams }: AssetFieldsPageProps) {
  const [customOn, canCategories, canViewSettings, canEditSettings] = await Promise.all([
    requireModule("custom_fields"),
    requirePermission("categories", "view"),
    requirePermission("settings", "view"),
    requirePermission("settings", "edit"),
  ]);
  const showExtra = customOn && canCategories;
  const workspace = canViewSettings ? await getWorkspaceSettingsForAdmin() : null;

  if (!showExtra && !canViewSettings) {
    redirect("/dashboard");
  }

  const categories = showExtra ? await getCategoriesForAdmin() : [];
  const selectedId =
    (typeof searchParams.category === "string" && categories.some((category) => category.id === searchParams.category)
      ? searchParams.category
      : categories[0]?.id) ?? null;
  const fields = selectedId ? await getCategoryFieldsForAdmin(selectedId) : [];
  const selected = categories.find((category) => category.id === selectedId) ?? null;

  const extra = showExtra ? (
    categories.length === 0 ? (
      <p className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-8 text-sm text-slate-500">
        Add a{" "}
        <Link href="/dashboard/administration/categories" className="underline">
          category
        </Link>{" "}
        first, then define fields that only that category asks for.
      </p>
    ) : (
      <CategoryFieldList categories={categories} selected={selected} fields={fields} />
    )
  ) : null;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Asset fields</h1>
        <p className="text-sm text-slate-500">
          Extra fields belong to one category. Built-in fields are the ones every asset already has — hide, rename, or require them here.
        </p>
      </div>
      <FieldPanels
        extra={extra}
        builtin={
          workspace && canEditSettings ? (
            <BuiltinFieldsForm settings={workspace} />
          ) : canViewSettings && !showExtra ? (
            <p className="text-sm text-slate-500">Only an editor can change built-in fields.</p>
          ) : null
        }
      />
    </div>
  );
}
