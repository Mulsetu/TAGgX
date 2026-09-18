import "server-only";
import { dispatchEventEmail } from "./dispatch";
import { getStaleOpenTickets } from "@/modules/maintenance/queries";
import {
  listAssetsDueOn,
  listDocumentsDueOn,
  listEnabledNotificationRulesAdmin,
  listTicketsDueOn,
} from "./queries";

function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "";

export async function runScheduledReminders(): Promise<{ reminders: number }> {
  const today = new Date().toISOString().slice(0, 10);
  const rules = await listEnabledNotificationRulesAdmin();
  let reminders = 0;

  for (const rule of rules) {
    const dueDate = addDays(today, rule.offsetDays);
    let items: Awaited<ReturnType<typeof listAssetsDueOn>> = [];
    if (rule.eventKey === "warranty_expiry") {
      items = await listAssetsDueOn(rule.companyId, "warranty_end_date", dueDate);
    } else if (rule.eventKey === "amc_expiry") {
      items = await listAssetsDueOn(rule.companyId, "amc_end_date", dueDate);
    } else if (rule.eventKey === "insurance_expiry") {
      items = await listAssetsDueOn(rule.companyId, "insurance_expiry_date", dueDate);
    } else if (rule.eventKey === "maintenance_due") {
      items = await listTicketsDueOn(rule.companyId, dueDate);
    } else if (rule.eventKey === "document_expiry") {
      items = await listDocumentsDueOn(rule.companyId, dueDate);
    } else {
      continue;
    }

    for (const item of items) {
      await dispatchEventEmail({
        companyId: rule.companyId,
        eventKey: rule.eventKey,
        entityId: item.id,
        occurrenceKey: `${rule.eventKey}:${item.id}:${dueDate}:${rule.offsetDays}`,
        vars: {
          asset_name: item.name,
          asset_code: item.assetCode,
          due_date: item.dueDate,
          asset_url: `${APP_URL}/assets/${item.id}`,
          maintenance_title: item.name,
        },
      });
      reminders += 1;
    }
  }

  const stale = await getStaleOpenTickets(14);
  for (const ticket of stale) {
    await dispatchEventEmail({
      companyId: ticket.companyId,
      eventKey: "maintenance_due",
      entityId: ticket.ticketId,
      occurrenceKey: `stale:${ticket.ticketId}`,
      vars: {
        asset_name: ticket.assetName,
        asset_code: ticket.assetCode,
        due_date: ticket.openedAt,
        asset_url: `${APP_URL}/assets/${ticket.assetId}`,
        maintenance_title: ticket.title,
      },
    });
    reminders += 1;
  }

  return { reminders };
}
