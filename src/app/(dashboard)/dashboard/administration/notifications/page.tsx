import { assertModule } from "@/lib/permissions/features";
import { assertPermission } from "@/lib/permissions/has-permission";
import {
  getEmailTemplatesForAdmin,
  getNotificationLogsForAdmin,
  getNotificationRulesForAdmin,
} from "@/modules/email/actions";
import { NotificationsAdmin } from "./notifications-admin";

export default async function NotificationsPage() {
  await assertModule("email");
  await assertPermission("notifications", "view");
  const [templates, rules, logs] = await Promise.all([
    getEmailTemplatesForAdmin(),
    getNotificationRulesForAdmin(),
    getNotificationLogsForAdmin(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
        <p className="text-sm text-muted-foreground">
          Edit reminder templates, turn rules on or off, and send a test email. Scheduled sends run via cron
          and are de-duplicated in the notification log.
        </p>
      </div>
      <NotificationsAdmin templates={templates} rules={rules} logs={logs} />
    </div>
  );
}
