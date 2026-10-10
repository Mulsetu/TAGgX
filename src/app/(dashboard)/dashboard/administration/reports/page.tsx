import { assertModule } from "@/lib/permissions/features";
import { assertPermission } from "@/lib/permissions/has-permission";
import { getAssetFilterOptionsForList } from "@/modules/assets/actions";
import { getAvailableReportKeys } from "@/modules/reports/actions";
import { ReportsAdmin } from "./reports-admin";

export default async function ReportsPage() {
  await assertModule("reports");
  await assertPermission("reports", "view");
  const [reportKeys, filterOptions] = await Promise.all([getAvailableReportKeys(), getAssetFilterOptionsForList()]);
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <p className="text-sm text-muted-foreground">
          Pick a report, narrow it down, choose the columns you need, and download it as Excel or CSV.
        </p>
      </div>
      <ReportsAdmin
        reportKeys={reportKeys}
        categories={filterOptions.categories}
        locations={filterOptions.locations}
        statuses={filterOptions.statuses}
      />
    </div>
  );
}
