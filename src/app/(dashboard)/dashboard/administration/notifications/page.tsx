import { assertModule } from "@/lib/permissions/features";
import { assertPermission, requirePermission } from "@/lib/permissions/has-permission";
import {
  getEmailDeliveryStatus,
  getEmailTemplatesForAdmin,
  getNotificationLogsForAdmin,
  getNotificationRulesForAdmin,
} from "@/modules/email/actions";
import { SettingsFrame } from "../settings/settings-frame";
import { NotificationsAdmin } from "./notifications-admin";

export default async function NotificationsPage() {
  await assertModule("email");
  await assertPermission("notifications", "view");
  const [templates, rules, logs, delivery, canEdit] = await Promise.all([
    getEmailTemplatesForAdmin(),
    getNotificationRulesForAdmin(),
    getNotificationLogsForAdmin(),
    getEmailDeliveryStatus(),
    requirePermission("notifications", "edit"),
  ]);

  return (
    <SettingsFrame>
      <NotificationsAdmin
        templates={templates}
        rules={rules}
        logs={logs}
        deliveryLive={delivery.live}
        canEdit={canEdit}
      />
    </SettingsFrame>
  );
}
