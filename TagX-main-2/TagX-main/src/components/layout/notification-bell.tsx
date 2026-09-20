"use client";

import { useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  getNotificationsForBell,
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/modules/notifications/actions";
import type { NotificationItem, NotificationSeverity } from "@/modules/notifications/types";

const SEVERITY_DOT_CLASS: Record<NotificationSeverity, string> = {
  info: "bg-sky-500",
  warning: "bg-amber-500",
  critical: "bg-destructive",
};

export function NotificationBell({ initialUnreadCount }: { initialUnreadCount: number }) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);

  async function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen && !loaded) {
      setLoading(true);
      const data = await getNotificationsForBell();
      setItems(data.items);
      setUnreadCount(data.unreadCount);
      setLoaded(true);
      setLoading(false);
    }
  }

  async function handleItemClick(item: NotificationItem) {
    if (item.readAt) return;
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, readAt: new Date().toISOString() } : i)));
    setUnreadCount((prev) => Math.max(prev - 1, 0));
    await markNotificationReadAction(item.id);
  }

  async function handleMarkAllRead() {
    setItems((prev) => prev.map((i) => ({ ...i, readAt: i.readAt ?? new Date().toISOString() })));
    setUnreadCount(0);
    await markAllNotificationsReadAction();
  }

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-8 w-8">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 ? (
            <span className="absolute right-1 top-1 flex h-2 w-2 rounded-full bg-destructive" />
          ) : null}
          <span className="sr-only">Notifications</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-2 py-1.5">
          <DropdownMenuLabel className="p-0 text-sm font-medium">Notifications</DropdownMenuLabel>
          {unreadCount > 0 ? (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Mark all as read
            </button>
          ) : null}
        </div>
        <DropdownMenuSeparator />
        <div className="max-h-80 overflow-y-auto">
          {loading ? (
            <p className="px-2 py-4 text-center text-sm text-muted-foreground">Loading...</p>
          ) : items.length === 0 ? (
            <p className="px-2 py-4 text-center text-sm text-muted-foreground">
              {loaded ? "No notifications yet." : ""}
            </p>
          ) : (
            items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleItemClick(item)}
                className={cn(
                  "flex w-full items-start gap-2 px-2 py-2 text-left text-sm hover:bg-accent",
                  !item.readAt && "bg-accent/50",
                )}
              >
                <span
                  className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", SEVERITY_DOT_CLASS[item.severity])}
                />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate font-medium">{item.title}</span>
                  <span className="line-clamp-2 text-xs text-muted-foreground">{item.message}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(item.createdAt).toLocaleString("en-US")}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
