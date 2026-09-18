export type NotificationSeverity = "info" | "warning" | "critical";

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  severity: NotificationSeverity;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationBellData {
  items: NotificationItem[];
  unreadCount: number;
}
