import "server-only";
import { sendMaintenanceReminderEmail, sendStorageWarningEmail } from "@/lib/email";
import { getStaleOpenTickets } from "@/modules/maintenance/queries";
import { getUpcomingWarrantyReminders } from "@/modules/assets/queries";
import {
  getCompanyAdminEmails,
  getCompanyStorageInfo,
  getUnemailedStorageThresholdNotifications,
  markNotificationEmailed,
} from "./queries";
import type { EmailBatchResult } from "./types";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "";

/**
 * Processes the storage-threshold "outbox" (see
 * getUnemailedStorageThresholdNotifications): for every notification that
 * hasn't been emailed yet, looks up that company's admins and sends
 * sendStorageWarningEmail to each.
 *
 * Not on any schedule itself. check_storage_thresholds() (pg_cron)
 * handles detection and inserts the notification row — Postgres can't
 * call the Brevo API — so *something* still needs to call this
 * periodically (a cron Route Handler, a manual admin trigger, etc.).
 * That wiring is a separate decision from this function existing.
 */
export async function sendPendingStorageWarningEmails(): Promise<EmailBatchResult> {
  const pending = await getUnemailedStorageThresholdNotifications();
  let sent = 0;
  let failed = 0;

  for (const notification of pending) {
    const [admins, storageInfo] = await Promise.all([
      getCompanyAdminEmails(notification.companyId),
      getCompanyStorageInfo(notification.companyId),
    ]);

    if (admins.length === 0 || !storageInfo) {
      failed += 1;
      continue;
    }

    const results = await Promise.all(
      admins.map((admin) =>
        sendStorageWarningEmail({
          to: admin.email,
          recipientName: admin.name ?? undefined,
          companyName: storageInfo.name,
          usedBytes: storageInfo.storageUsedBytes,
          limitBytes: storageInfo.storageLimitBytes,
          thresholdPercent: notification.thresholdPercent,
        }),
      ),
    );

    if (results.some((result) => !("error" in result))) {
      sent += 1;
      await markNotificationEmailed(notification.id);
    } else {
      failed += 1;
    }
  }

  return { sent, failed };
}

/**
 * Sends due reminders for assets whose warranty/AMC/insurance expires
 * within `warrantyDaysAhead` days, and for maintenance tickets that have
 * been open for at least `staleTicketDays` days. Same caveat as above:
 * not scheduled on its own.
 */
export async function sendUpcomingMaintenanceReminderEmails(
  warrantyDaysAhead = 30,
  staleTicketDays = 14,
): Promise<EmailBatchResult> {
  const [warrantyReminders, staleTickets] = await Promise.all([
    getUpcomingWarrantyReminders(warrantyDaysAhead),
    getStaleOpenTickets(staleTicketDays),
  ]);

  let sent = 0;
  let failed = 0;

  const adminCache = new Map<string, Awaited<ReturnType<typeof getCompanyAdminEmails>>>();
  async function adminsFor(companyId: string) {
    const cached = adminCache.get(companyId);
    if (cached) return cached;
    const admins = await getCompanyAdminEmails(companyId);
    adminCache.set(companyId, admins);
    return admins;
  }

  for (const reminder of warrantyReminders) {
    const admins = await adminsFor(reminder.companyId);
    if (admins.length === 0) {
      failed += 1;
      continue;
    }

    const results = await Promise.all(
      admins.map((admin) =>
        sendMaintenanceReminderEmail({
          to: admin.email,
          recipientName: admin.name ?? undefined,
          assetName: reminder.name,
          assetCode: reminder.assetCode,
          reason: reminder.reason,
          dueDate: reminder.dueDate,
          assetUrl: `${APP_URL}/assets/${reminder.assetId}`,
        }),
      ),
    );

    if (results.some((result) => !("error" in result))) sent += 1;
    else failed += 1;
  }

  for (const ticket of staleTickets) {
    const admins = await adminsFor(ticket.companyId);
    if (admins.length === 0) {
      failed += 1;
      continue;
    }

    const results = await Promise.all(
      admins.map((admin) =>
        sendMaintenanceReminderEmail({
          to: admin.email,
          recipientName: admin.name ?? undefined,
          assetName: ticket.assetName,
          assetCode: ticket.assetCode,
          reason: "maintenance",
          dueDate: ticket.openedAt,
          assetUrl: `${APP_URL}/assets/${ticket.assetId}`,
        }),
      ),
    );

    if (results.some((result) => !("error" in result))) sent += 1;
    else failed += 1;
  }

  return { sent, failed };
}
