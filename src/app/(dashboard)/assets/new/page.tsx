import Link from "next/link";
import { Button } from "@/components/ui/button";
import { assertModule } from "@/lib/permissions/features";
import { assertPermission } from "@/lib/permissions/has-permission";
import { getCurrentCompanyQuota } from "@/modules/billing/actions";
import { getAssetFormOptionsForForm } from "@/modules/assets/actions";
import { AssetForm } from "../asset-form";

export default async function NewAssetPage() {
  await assertModule("assets");
  await assertPermission("assets", "create");
  const quota = await getCurrentCompanyQuota();

  if (quota.atLimit) {
    return (
      <div className="flex max-w-lg flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Asset limit reached</h1>
        <p className="text-sm text-muted-foreground">
          This workspace is on the {quota.plan?.name ?? "current"} plan (
          {(quota.effectiveLimit ?? 0).toLocaleString("en-IN")} assets). Buy extra packs in
          Settings to add more.
        </p>
        <Button asChild className="self-start">
          <Link href="/dashboard/administration/settings">Get more assets</Link>
        </Button>
      </div>
    );
  }

  const options = await getAssetFormOptionsForForm();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">New asset</h1>
      {quota.remaining !== null ? (
        <p className="text-sm text-muted-foreground">
          {quota.remaining.toLocaleString("en-IN")} asset
          {quota.remaining === 1 ? "" : "s"} remaining on your plan.
        </p>
      ) : null}
      <AssetForm mode="create" options={options} />
    </div>
  );
}
