import { CompanyHome } from "@/components/dashboard/company-home";
import { requireModule } from "@/lib/permissions/features";
import { requirePermission } from "@/lib/permissions/has-permission";
import { getInventoryTrendForDashboard, getRecentAssetsForDashboard } from "@/modules/assets/actions";
import { getDashboardHome } from "@/modules/reports/actions";
import { getVendorScope } from "@/modules/users/actions";
import { redirect } from "next/navigation";

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

  const [widgets, recentAssets, trendPercent, canCreate] = await Promise.all([
    getDashboardHome(),
    getRecentAssetsForDashboard(),
    getInventoryTrendForDashboard(),
    (async () => (await requireModule("assets")) && (await requirePermission("assets", "create")))(),
  ]);

  if (widgets.length === 0 && recentAssets.length === 0) {
    return <p className="text-sm text-slate-500">No dashboard widgets are available for your role.</p>;
  }

  return (
    <CompanyHome widgets={widgets} recentAssets={recentAssets} trendPercent={trendPercent} canCreate={canCreate} />
  );
}
