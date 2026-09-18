import { assertModule } from "@/lib/permissions/features";
import { assertPermission } from "@/lib/permissions/has-permission";
import { getAssetFormOptionsForForm } from "@/modules/assets/actions";
import { getMaintenancePlansForAdmin } from "@/modules/maintenance/actions";
import { getVendorOptions } from "@/modules/vendors/actions";
import { PlanList } from "./plan-list";

export default async function MaintenancePlansPage() {
  await assertModule("preventive_maintenance");
  await assertPermission("maintenance", "view");
  const [plans, options, vendors] = await Promise.all([
    getMaintenancePlansForAdmin(),
    getAssetFormOptionsForForm(),
    getVendorOptions(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Preventive maintenance</h1>
        <p className="text-sm text-muted-foreground">
          Recurring plans generate tickets automatically when they come due.
        </p>
      </div>
      <PlanList plans={plans} assets={options.linkableAssets} vendors={vendors} users={options.users} />
    </div>
  );
}
