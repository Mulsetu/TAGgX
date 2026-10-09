import { assertPermission, requirePermission } from "@/lib/permissions/has-permission";
import { getConditionUsageForAdmin, getConditionsForAdmin } from "@/modules/conditions/actions";
import { ConditionList } from "./condition-list";

export default async function ConditionsPage() {
  await assertPermission("statuses", "view");
  const [conditions, usage, canEdit] = await Promise.all([
    getConditionsForAdmin(),
    getConditionUsageForAdmin(),
    requirePermission("statuses", "edit"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Conditions</h1>
        <p className="text-sm text-muted-foreground">
          Physical condition labels used on assets and audits. Colours here are the badges people see.
        </p>
      </div>
      <ConditionList conditions={conditions} usage={usage} canEdit={canEdit} />
    </div>
  );
}
