import { assertModule } from "@/lib/permissions/features";
import { assertPermission } from "@/lib/permissions/has-permission";
import { getAvailableReportKeys, getImportJobsForAdmin } from "@/modules/reports/actions";
import { ReportsAdmin } from "./reports-admin";

export default async function ReportsPage() {
  await assertModule("reports");
  await assertPermission("reports", "view");
  const [jobs, reportKeys] = await Promise.all([getImportJobsForAdmin(), getAvailableReportKeys()]);
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <p className="text-sm text-muted-foreground">
          Standard CSV and Excel exports, plus bulk asset import with a preview and error file.
        </p>
      </div>
      <ReportsAdmin jobs={jobs} reportKeys={reportKeys} />
    </div>
  );
}
