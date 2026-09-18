import Link from "next/link";
import { assertModule } from "@/lib/permissions/features";
import { assertPermission } from "@/lib/permissions/has-permission";
import { getCategoriesForAdmin, getCategoryFieldsForAdmin } from "@/modules/categories/actions";
import { CategoryFieldList } from "./field-list";

interface AssetFieldsPageProps {
  searchParams: { category?: string };
}

export default async function AssetFieldsPage({ searchParams }: AssetFieldsPageProps) {
  await assertModule("custom_fields");
  await assertPermission("categories", "view");
  const categories = await getCategoriesForAdmin();
  const selectedId =
    (typeof searchParams.category === "string" && categories.some((category) => category.id === searchParams.category)
      ? searchParams.category
      : categories[0]?.id) ?? null;
  const fields = selectedId ? await getCategoryFieldsForAdmin(selectedId) : [];
  const selected = categories.find((category) => category.id === selectedId) ?? null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Asset fields</h1>
        <p className="text-sm text-muted-foreground">
          Extra fields shown when creating or editing an asset in a category. Core fields like name and
          status stay the same; these are category-specific.
        </p>
      </div>

      {categories.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Add a{" "}
          <Link href="/dashboard/administration/categories" className="underline">
            category
          </Link>{" "}
          first, then come back to define its fields.
        </p>
      ) : (
        <CategoryFieldList categories={categories} selected={selected} fields={fields} />
      )}
    </div>
  );
}
