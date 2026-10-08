import { SidebarTrigger } from "@/components/ui/sidebar";
import { TagXLogo } from "./brand-logo";
import { getUnreadNotificationCountForBell } from "@/modules/notifications/actions";
import { NotificationBell } from "./notification-bell";

export async function TopBar() {
  const unreadCount = await getUnreadNotificationCountForBell();

  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4">
      <SidebarTrigger className="size-10 text-slate-600 md:size-8" />
      <div className="flex-1" />
      <NotificationBell initialUnreadCount={unreadCount} />
      <TagXLogo size={32} className="h-8 w-auto max-w-[7.5rem] object-contain" />
    </header>
  );
}
