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
  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
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
