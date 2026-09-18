import { SidebarTrigger } from "@/components/ui/sidebar";
import { getUnreadNotificationCountForBell } from "@/modules/notifications/actions";
import { NotificationBell } from "./notification-bell";

export async function TopBar() {
  const unreadCount = await getUnreadNotificationCountForBell();

  return (
    <header className="flex min-h-14 shrink-0 items-center gap-2 border-b px-4 pt-[env(safe-area-inset-top)]">
      <SidebarTrigger className="size-11 md:size-7" />
      <div className="flex-1" />
      <NotificationBell initialUnreadCount={unreadCount} />
    </header>
  );
}
