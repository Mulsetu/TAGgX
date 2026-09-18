import { redirect } from "next/navigation";
import { SimpleBarChart, type BarChartDatum } from "@/components/charts/simple-bar-chart";
import { requireModule } from "@/lib/permissions/features";
import { requirePermission } from "@/lib/permissions/has-permission";
import {
  getAssetCountsByCategoryForDashboard,
  getAssetCountsByStatusForDashboard,
} from "@/modules/assets/actions";
import { getOpenMaintenanceTicketsForDashboard } from "@/modules/maintenance/actions";
import { getDashboardTilesForHome } from "@/modules/reports/actions";
import { getVendorScope } from "@/modules/users/actions";
import Link from "next/link";

export default async function DashboardPage() {
  const vendorId = await getVendorScope();
  if (vendorId) {
    if ((await requireModule("maintenance")) && (await requirePermission("maintenance", "view"))) {
      redirect("/dashboard/administration/maintenance");
    }
    if (await requirePermission("assets", "view")) {
      redirect("/assets");
    }
  }

  const [byCategory, byStatus, openTickets, tiles, showMaintenance] = await Promise.all([
    getAssetCountsByCategoryForDashboard(),
    getAssetCountsByStatusForDashboard(),
    getOpenMaintenanceTicketsForDashboard(),
    getDashboardTilesForHome(),
    requireModule("maintenance"),
  ]);

  const categoryChartData: BarChartDatum[] = byCategory.map((row) => ({
    name: row.categoryName,
    value: row.count,
  }));

  const statusChartData: BarChartDatum[] = byStatus.map((row) => ({
    name: row.statusName,
    value: row.count,
  }));

  const openTicketsChartData: BarChartDatum[] = openTickets.map((row) => ({
    name: row.label,
    value: row.count,
  }));

  const charts = [
    { title: "Assets by category", data: categoryChartData, show: true },
    { title: "Assets by status", data: statusChartData, show: true },
    { title: "Open maintenance tickets", data: openTicketsChartData, show: showMaintenance },
  ].filter((chart) => chart.show);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Company overview.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 @lg:grid-cols-5">
        {tiles.map((tile) => (
          <Link key={tile.label} href={tile.href} className="rounded-lg border p-4 hover:bg-muted/40">
            <p className="text-xs text-muted-foreground">{tile.label}</p>
            <p className="text-2xl font-semibold tracking-tight">{tile.value}</p>
          </Link>
        ))}
      </div>
      {/*
        The grid reflows based on how much width main content actually has
        (via the @container on <main> in the dashboard layout), not the
        viewport — so it adapts the same way whether the sidebar is a rail,
        collapsed to icons, or a mobile drawer.
      */}
      <div className="grid grid-cols-1 gap-4 @lg:grid-cols-2 @2xl:grid-cols-3">
        {charts.map((chart) => (
          <div key={chart.title} className="rounded-lg border p-4">
            <p className="mb-2 text-sm font-medium">{chart.title}</p>
            {chart.data.length === 0 ? (
              <p className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
                No data yet
              </p>
            ) : (
              <SimpleBarChart data={chart.data} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
