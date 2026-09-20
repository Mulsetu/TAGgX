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
import { getAssetFilterOptionsForList, getAssetsForList } from "@/modules/assets/actions";
import { AssetFilters } from "./asset-filters";

interface AssetsPageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

function pageHref(searchParams: AssetsPageProps["searchParams"], targetPage: number): string {
  const params = new URLSearchParams();
  for (const key of ["category", "location", "status"] as const) {
    // key comes from the fixed literal array above, not user input.
    // eslint-disable-next-line security/detect-object-injection
    const value = searchParams[key];
    if (typeof value === "string" && value) {
      params.set(key, value);
    }
  }
  params.set("page", String(targetPage));
  return `/assets?${params.toString()}`;
}

export default async function AssetsPage({ searchParams }: AssetsPageProps) {
  const [{ items, totalCount, page, pageSize }, filterOptions] = await Promise.all([
    getAssetsForList(searchParams),
    getAssetFilterOptionsForList(),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Assets</h1>
          <p className="text-sm text-muted-foreground">{totalCount} total</p>
        </div>
        <Button asChild>
          <Link href="/assets/new">New asset</Link>
        </Button>
      </div>

      <AssetFilters
        categories={filterOptions.categories}
        locations={filterOptions.locations}
        statuses={filterOptions.statuses}
      />

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No assets found.
                </TableCell>
              </TableRow>
            ) : (
              items.map((asset) => (
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
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            {page > 1 ? (
              <Button asChild variant="outline" size="sm">
                <Link href={pageHref(searchParams, page - 1)}>Previous</Link>
              </Button>
            ) : null}
            {page < totalPages ? (
              <Button asChild variant="outline" size="sm">
                <Link href={pageHref(searchParams, page + 1)}>Next</Link>
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
