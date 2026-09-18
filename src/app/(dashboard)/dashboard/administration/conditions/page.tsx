import { assertPermission } from "@/lib/permissions/has-permission";
import { getConditionsForAdmin } from "@/modules/conditions/actions";
import { ConditionList } from "./condition-list";

export default async function ConditionsPage() {
  await assertPermission("statuses", "view");
  const conditions = await getConditionsForAdmin();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Conditions</h1>
        <p className="text-sm text-muted-foreground">
          Physical condition labels used on assets and audits. Disable a condition instead of
          deleting it if historical records still use the key.
        </p>
      </div>
      <ConditionList conditions={conditions} />
    </div>
  );
}
