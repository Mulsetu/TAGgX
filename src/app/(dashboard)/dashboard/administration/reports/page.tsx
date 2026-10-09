import { assertModule } from "@/lib/permissions/features";
import { assertPermission } from "@/lib/permissions/has-permission";
import { getAvailableReportKeys } from "@/modules/reports/actions";
import { ReportsAdmin } from "./reports-admin";

export default async function ReportsPage() {
  await assertModule("reports");
  await assertPermission("reports", "view");
  const reportKeys = await getAvailableReportKeys();
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <p className="text-sm text-muted-foreground">
          Company-wide downloads for finance, audits and management. To add assets in bulk, use Import on the Assets page.
        </p>
      </div>
      <ReportsAdmin reportKeys={reportKeys} />
    </div>
  );
}
