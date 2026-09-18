"use server";

import "server-only";
import { getUnreadNotificationCount, listRecentNotifications } from "./queries";
import { markAllNotificationsRead, markNotificationRead } from "./mutations";
import type { NotificationBellData } from "./types";

/** For the bell icon's badge — cheap enough to call on every page load. */
export async function getUnreadNotificationCountForBell(): Promise<number> {
  return getUnreadNotificationCount();
}

/** Full list, fetched when the bell dropdown is actually opened. */
export async function getNotificationsForBell(): Promise<NotificationBellData> {
  const [items, unreadCount] = await Promise.all([listRecentNotifications(20), getUnreadNotificationCount()]);
  return { items, unreadCount };
}

export async function markNotificationReadAction(id: string): Promise<{ error: string | null }> {
  return markNotificationRead(id);
}

export async function markAllNotificationsReadAction(): Promise<{ error: string | null }> {
  return markAllNotificationsRead();
}
