import { assertModule, requireModule } from "@/lib/permissions/features";
import { assertPermission, requirePermission } from "@/lib/permissions/has-permission";
import { getCurrentCompanyQuota } from "@/modules/billing/actions";
import { getAssetFilterOptionsForList, getAssetsForList } from "@/modules/assets/actions";
import { AssetBrowser } from "./asset-browser";

interface AssetsPageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

export default async function AssetsPage({ searchParams }: AssetsPageProps) {
  await assertModule("assets");
  await assertPermission("assets", "view");
  const [list, filterOptions, quota, canCreate, qrOn, canEdit] = await Promise.all([
    getAssetsForList(searchParams),
    getAssetFilterOptionsForList(),
    getCurrentCompanyQuota(),
    requirePermission("assets", "create"),
    requireModule("qr"),
    requirePermission("assets", "edit"),
  ]);

  return (
    <AssetBrowser
      items={list.items}
      totalCount={list.totalCount}
      page={list.page}
      pageSize={list.pageSize}
      assetCount={quota.assetCount}
      assetLimit={quota.effectiveLimit}
      canCreate={canCreate}
      canGenerateQr={qrOn && canEdit}
      atLimit={quota.atLimit}
      categories={filterOptions.categories}
      locations={filterOptions.locations}
      statuses={filterOptions.statuses}
      vendors={filterOptions.vendors}
      users={filterOptions.users}
      conditions={filterOptions.conditions}
    />
  );
}
