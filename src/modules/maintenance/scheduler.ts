import "server-only";
import { bumpPlanNextDue, createTicketAdmin } from "./mutations";
import { getAdminAssetForPlan, listDueMaintenancePlans, planHasTicketForDue } from "./queries";

function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function addMonths(isoDate: string, months: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString().slice(0, 10);
}

function nextDueDate(frequency: string, currentDue: string, intervalDays: number | null): string {
  switch (frequency) {
    case "daily":
      return addDays(currentDue, 1);
    case "weekly":
      return addDays(currentDue, 7);
    case "monthly":
      return addMonths(currentDue, 1);
    case "quarterly":
      return addMonths(currentDue, 3);
    case "half_yearly":
      return addMonths(currentDue, 6);
    case "yearly":
      return addMonths(currentDue, 12);
    case "custom":
      return addDays(currentDue, intervalDays && intervalDays > 0 ? intervalDays : 30);
    default:
      return addMonths(currentDue, 1);
  }
}

export async function generateDuePlanTickets(asOf = new Date().toISOString().slice(0, 10)): Promise<{ created: number; skipped: number }> {
  const plans = await listDueMaintenancePlans(asOf);
  let created = 0;
  let skipped = 0;

  for (const plan of plans) {
    const asset = await getAdminAssetForPlan(plan.asset_id);
    if (!asset || asset.isFinal) {
      skipped += 1;
      continue;
    }
    if (await planHasTicketForDue(plan.id, plan.next_due_at)) {
      skipped += 1;
      await bumpPlanNextDue(plan.id, nextDueDate(plan.frequency, plan.next_due_at, plan.interval_days), asOf);
      continue;
    }

    const result = await createTicketAdmin({
      companyId: plan.company_id,
      assetId: plan.asset_id,
      title: `${plan.name} — ${asset.name}`,
      vendorId: plan.vendor_id,
      assignedTo: plan.assigned_to,
      dueAt: plan.next_due_at,
      planId: plan.id,
    });
    if ("error" in result) {
      skipped += 1;
      continue;
    }
    await bumpPlanNextDue(plan.id, nextDueDate(plan.frequency, plan.next_due_at, plan.interval_days), asOf);
    created += 1;
  }

  return { created, skipped };
}
