import { assertPermission, requirePermission } from "@/lib/permissions/has-permission";
import { getStatusUsageForAdmin, getStatusesForAdmin } from "@/modules/statuses/actions";
import { StatusList } from "./status-list";

export default async function StatusesPage() {
  await assertPermission("statuses", "view");
  const [statuses, usage, canEdit] = await Promise.all([
    getStatusesForAdmin(),
    getStatusUsageForAdmin(),
    requirePermission("statuses", "edit"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Statuses</h1>
        <p className="text-sm text-muted-foreground">
          The lifecycle states an asset can be in. Colours here are the badges people see on every asset.
        </p>
      </div>

      <StatusList statuses={statuses} usage={usage} canEdit={canEdit} />
    </div>
  );
}
