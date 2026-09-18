"use server";

import "server-only";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { TENANT_HEADERS } from "@/lib/tenant";
import { sendMaintenanceReminderEmail, sendStorageWarningEmail, sendTemplatedEmail } from "@/lib/email";
import { requirePermission } from "@/lib/permissions/has-permission";
import { requireModule } from "@/lib/permissions/features";
import { TENANT_READ_ONLY_MESSAGE, requireWritableTenant } from "@/lib/permissions/tenant-access";
import { writeAuditLog } from "@/lib/audit-log";
import { clientIpFromHeaders, consumeRateLimit } from "@/lib/rate-limit";
import { getRequestAuthUser } from "@/lib/supabase/server";
import { getStaleOpenTickets } from "@/modules/maintenance/queries";
import { getUpcomingWarrantyReminders } from "@/modules/assets/queries";
import {
  getCompanyAdminEmails,
  getCompanyStorageInfo,
  getUnemailedStorageThresholdNotifications,
  listEmailTemplates,
  listNotificationRules,
  listRecentNotificationLogs,
  markNotificationEmailed,
} from "./queries";
import { setNotificationRuleEnabled, updateEmailTemplate } from "./mutations";
import { testEmailSchema, updateTemplateSchema } from "./validation";
import type {
  EmailBatchResult,
  EmailFormState,
  EmailTemplateSummary,
  NotificationLogSummary,
  NotificationRuleSummary,
} from "./types";

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

const PATH = "/dashboard/administration/notifications";

export async function getEmailTemplatesForAdmin(): Promise<EmailTemplateSummary[]> {
  if (!(await requireModule("email")) || !(await requirePermission("notifications", "view"))) {
    return [];
  }
  return listEmailTemplates();
}

export async function getNotificationRulesForAdmin(): Promise<NotificationRuleSummary[]> {
  if (!(await requireModule("email")) || !(await requirePermission("notifications", "view"))) {
    return [];
  }
  return listNotificationRules();
}

export async function getNotificationLogsForAdmin(): Promise<NotificationLogSummary[]> {
  if (!(await requireModule("email")) || !(await requirePermission("notifications", "view"))) {
    return [];
  }
  return listRecentNotificationLogs();
}

export async function updateEmailTemplateAction(
  id: string,
  _prev: EmailFormState,
  formData: FormData,
): Promise<EmailFormState> {
  if (!(await requireWritableTenant())) {
    return { error: TENANT_READ_ONLY_MESSAGE };
  }
  if (!(await requireModule("email")) || !(await requirePermission("notifications", "edit"))) {
    return { error: "You don't have permission to edit templates." };
  }
  const parsed = updateTemplateSchema.safeParse({
    subject: formData.get("subject"),
    htmlBody: formData.get("htmlBody"),
    textBody: formData.get("textBody"),
    isEnabled: formData.get("isEnabled") === "on",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const result = await updateEmailTemplate(id, parsed.data);
  if (result.error) {
    return { error: result.error };
  }
  await writeAuditLog({ action: "email_template.updated", entityType: "email_template", entityId: id });
  revalidatePath(PATH);
  return { error: null, success: "Template saved." };
}

export async function toggleNotificationRuleAction(id: string, isEnabled: boolean): Promise<EmailFormState> {
  if (!(await requireWritableTenant())) {
    return { error: TENANT_READ_ONLY_MESSAGE };
  }
  if (!(await requireModule("email")) || !(await requirePermission("notifications", "edit"))) {
    return { error: "You don't have permission to edit rules." };
  }
  const result = await setNotificationRuleEnabled(id, isEnabled);
  if (result.error) {
    return { error: result.error };
  }
  revalidatePath(PATH);
  return { error: null, success: "Rule updated." };
}

export async function sendTestEmailAction(_prev: EmailFormState, formData: FormData): Promise<EmailFormState> {
  if (!(await requireWritableTenant())) {
    return { error: TENANT_READ_ONLY_MESSAGE };
  }
  if (!(await requireModule("email")) || !(await requirePermission("notifications", "edit"))) {
    return { error: "You don't have permission to send test emails." };
  }
  const companyId = headers().get(TENANT_HEADERS.companyId);
  const user = await getRequestAuthUser();
  if (!companyId || !user) {
    return { error: "Could not determine your company." };
  }

  const ip = clientIpFromHeaders(headers());
  if (!consumeRateLimit(`test-email:${companyId}:${ip}`, 3, 60_000)) {
    return { error: "Too many test emails. Try again in a minute." };
  }

  const parsed = testEmailSchema.safeParse({
    eventKey: formData.get("eventKey"),
    to: formData.get("to"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const templates = await listEmailTemplates();
  const template = templates.find((row) => row.eventKey === parsed.data.eventKey);
  if (!template) {
    return { error: "Template not found." };
  }

  const to = parsed.data.to ?? user.email;
  if (!to) {
    return { error: "No recipient email." };
  }

  const result = await sendTemplatedEmail({
    to,
    subject: template.subject,
    htmlBody: template.htmlBody,
    textBody: template.textBody,
    vars: {
      asset_name: "Sample asset",
      asset_code: "AST-00001",
      due_date: new Date().toISOString().slice(0, 10),
      asset_url: `${APP_URL}/assets`,
      maintenance_title: "Sample ticket",
      vendor_name: "Sample vendor",
      organization_name: "TagX",
    },
  });
  if ("error" in result) {
    return { error: result.error };
  }
  return { error: null, success: `Test email sent to ${to}.` };
}
