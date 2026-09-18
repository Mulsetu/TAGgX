import { assertModule } from "@/lib/permissions/features";
import { assertPermission } from "@/lib/permissions/has-permission";
import { getMaintenanceTicketsForAdmin, getMaintenanceTypesForForm } from "@/modules/maintenance/actions";
import { getAssetFormOptionsForForm } from "@/modules/assets/actions";
import { getVendorOptions } from "@/modules/vendors/actions";
import { CreateTicketForm } from "./create-ticket-form";
import { TicketList } from "./ticket-list";

export default async function MaintenancePage() {
  await assertModule("maintenance");
  await assertPermission("maintenance", "view");
  const [tickets, options, vendors, types] = await Promise.all([
    getMaintenanceTicketsForAdmin(),
    getAssetFormOptionsForForm(),
    getVendorOptions(),
    getMaintenanceTypesForForm(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Maintenance</h1>
        <p className="text-sm text-muted-foreground">Track repair and service tickets for your assets.</p>
      </div>

      <CreateTicketForm assets={options.linkableAssets} vendors={vendors} types={types} />
      <TicketList tickets={tickets} users={options.users} />
    </div>
  );
}
