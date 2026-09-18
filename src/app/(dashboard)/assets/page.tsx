import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { assertModule } from "@/lib/permissions/features";
import { assertPermission, requirePermission } from "@/lib/permissions/has-permission";
import { getCurrentCompanyQuota } from "@/modules/billing/actions";
import { getAssetFilterOptionsForList, getAssetsForList } from "@/modules/assets/actions";
import { AssetFilters } from "./asset-filters";

interface AssetsPageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

const LIST_KEYS = [
  "q",
  "category",
  "location",
  "status",
  "vendor",
  "custodian",
  "condition",
  "warranty",
  "amc",
  "docs",
  "sort",
  "dir",
  "archived",
] as const;

function pageHref(searchParams: AssetsPageProps["searchParams"], targetPage: number): string {
  const params = new URLSearchParams();
  for (const key of LIST_KEYS) {
    const value = searchParams[key];
    if (typeof value === "string" && value) {
      params.set(key, value);
    }
  }
  params.set("page", String(targetPage));
  return `/assets?${params.toString()}`;
}

export default async function AssetsPage({ searchParams }: AssetsPageProps) {
  await assertModule("assets");
  await assertPermission("assets", "view");
  const [{ items, totalCount, page, pageSize }, filterOptions, quota, canCreate] = await Promise.all([
    getAssetsForList(searchParams),
    getAssetFilterOptionsForList(),
    getCurrentCompanyQuota(),
    requirePermission("assets", "create"),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const hasFilters = LIST_KEYS.some((key) => typeof searchParams[key] === "string" && searchParams[key]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Assets</h1>
          <p className="text-sm text-muted-foreground">
            {quota.effectiveLimit !== null
              ? `${quota.assetCount.toLocaleString("en-IN")} of ${quota.effectiveLimit.toLocaleString("en-IN")} assets used`
              : `${totalCount} total`}
          </p>
        </div>
        {canCreate && quota.atLimit ? (
          <Button asChild variant="outline" className="w-full sm:w-auto" size="touch">
            <Link href="/dashboard/administration/settings">Get more assets</Link>
          </Button>
        ) : canCreate ? (
          <Button asChild className="w-full sm:w-auto" size="touch">
            <Link href="/assets/new">New asset</Link>
          </Button>
        ) : null}
      </div>

      <AssetFilters
        categories={filterOptions.categories}
        locations={filterOptions.locations}
        statuses={filterOptions.statuses}
        vendors={filterOptions.vendors}
        users={filterOptions.users}
        conditions={filterOptions.conditions}
      />

      {items.length === 0 ? (
        <div className="rounded-lg border p-6 text-center">
          <p className="text-sm font-medium">{hasFilters ? "No assets match these filters." : "No assets yet."}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {hasFilters
              ? "Clear the search or filters to see more of the inventory."
              : canCreate
                ? "Create the first asset to start tracking equipment."
                : "Ask an administrator to add assets for this company."}
          </p>
        </div>
      ) : (
        <>
          <ul className="flex flex-col gap-3 md:hidden">
            {items.map((asset) => (
              <li key={asset.id}>
                <Link href={`/assets/${asset.id}`} className="flex min-h-16 flex-col gap-1 rounded-xl border p-4 active:bg-muted">
                  <span className="font-medium">{asset.name}</span>
                  <span className="text-sm text-muted-foreground">{asset.assetCode}</span>
                  <span className="text-xs text-muted-foreground">
                    {asset.categoryName ?? "—"} · {asset.locationName ?? "—"} · {asset.statusName}
                  </span>
                  {asset.serialNumber || asset.vendorName || asset.allottedToName ? (
                    <span className="text-xs text-muted-foreground">
                      {[asset.serialNumber, asset.vendorName, asset.allottedToName].filter(Boolean).join(" · ")}
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto rounded-lg border md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Custodian</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((asset) => (
                  <TableRow key={asset.id}>
                    <TableCell className="font-medium">
                      <Link href={`/assets/${asset.id}`} className="hover:underline">
                        {asset.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{asset.assetCode}</TableCell>
                    <TableCell className="text-muted-foreground">{asset.categoryName ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{asset.locationName ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{asset.statusName}</TableCell>
                    <TableCell className="text-muted-foreground">{asset.allottedToName ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            {page > 1 ? (
              <Button asChild variant="outline" className="min-h-11">
                <Link href={pageHref(searchParams, page - 1)}>Previous</Link>
              </Button>
            ) : null}
            {page < totalPages ? (
              <Button asChild variant="outline" className="min-h-11">
                <Link href={pageHref(searchParams, page + 1)}>Next</Link>
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
