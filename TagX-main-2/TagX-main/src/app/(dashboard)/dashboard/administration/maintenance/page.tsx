import { getMaintenanceTicketsForAdmin } from "@/modules/maintenance/actions";
import { getAssetFormOptionsForForm } from "@/modules/assets/actions";
import { CreateTicketForm } from "./create-ticket-form";
import { TicketList } from "./ticket-list";

export default async function MaintenancePage() {
  const [tickets, options] = await Promise.all([getMaintenanceTicketsForAdmin(), getAssetFormOptionsForForm()]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Maintenance</h1>
        <p className="text-sm text-muted-foreground">Track repair and service tickets for your assets.</p>
      </div>

      <CreateTicketForm assets={options.linkableAssets} />
      <TicketList tickets={tickets} users={options.users} />
    </div>
  );
}
