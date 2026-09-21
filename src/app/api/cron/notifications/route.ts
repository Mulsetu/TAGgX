import { timingSafeEqual } from "node:crypto";
import { generateDuePlanTickets } from "@/modules/maintenance/scheduler";
import { sendPendingStorageWarningEmails } from "@/modules/email/actions";
import { runScheduledReminders } from "@/modules/email/scheduler";
import { retryFailedNotificationEmails } from "@/modules/email/dispatch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return false;
  }
  const header = request.headers.get("authorization") ?? "";
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header);
  // Same-length check before timingSafeEqual: it throws (rather than
  // returning false) on mismatched buffer lengths, which the length check
  // itself doesn't leak anything sensitive about (the secret's length
  // isn't secret — CRON_SECRET is an operator-set env var, not derived
  // from user input).
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tickets = await generateDuePlanTickets();
  const storage = await sendPendingStorageWarningEmails();
  const reminders = await runScheduledReminders();
  const retries = await retryFailedNotificationEmails();

  return Response.json({ ok: true, tickets, storage, reminders, retries });
}

export async function GET(request: Request) {
  return POST(request);
}
