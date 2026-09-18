import { getAllPlansForAdmin } from "@/modules/billing/actions";
import { PlanList } from "./plan-list";

export default async function AdminPlansPage() {
  const plans = await getAllPlansForAdmin();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Plans</h1>
        <p className="text-sm text-muted-foreground">
          Monthly price, asset cap, and extra-asset pack for every company. These are what
          visitors see on the public landing page.
        </p>
      </div>
      <PlanList plans={plans} />
    </div>
  );
}
