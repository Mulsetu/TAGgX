import { assertPermission } from "@/lib/permissions/has-permission";
import { getStatusesForAdmin } from "@/modules/statuses/actions";
import { StatusList } from "./status-list";

export default async function StatusesPage() {
  await assertPermission("statuses", "view");
  const statuses = await getStatusesForAdmin();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Statuses</h1>
        <p className="text-sm text-muted-foreground">
          The lifecycle states an asset can be in. Every company starts with 5 defaults — add,
          rename, or remove statuses to fit how your team actually works.
        </p>
      </div>

      <StatusList statuses={statuses} />
    </div>
  );
}
