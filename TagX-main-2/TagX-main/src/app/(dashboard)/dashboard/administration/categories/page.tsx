import { getCategoriesForAdmin } from "@/modules/categories/actions";
import { CategoryList } from "./category-list";

export default async function CategoriesPage() {
  const categories = await getCategoriesForAdmin();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Categories</h1>
        <p className="text-sm text-muted-foreground">
          Organize assets into categories. Click a category to edit or delete it.
        </p>
      </div>

      <CategoryList categories={categories} />
    </div>
  );
}
