import { getAssetFormOptionsForForm } from "@/modules/assets/actions";
import { AssetForm } from "../asset-form";

export default async function NewAssetPage() {
  const options = await getAssetFormOptionsForForm();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">New asset</h1>
      <AssetForm mode="create" options={options} />
    </div>
  );
}
