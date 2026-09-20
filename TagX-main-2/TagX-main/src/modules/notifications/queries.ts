import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { NotificationItem, NotificationSeverity } from "./types";

interface NotificationRow {
  id: string;
  type: string;
  title: string;
  message: string;
  severity: NotificationSeverity;
  read_at: string | null;
  created_at: string;
}

/** Most recent notifications for the caller's own company (RLS-scoped). */
export async function listRecentNotifications(limit = 20): Promise<NotificationItem[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("notifications")
    .select("id, type, title, message, severity, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<NotificationRow[]>();

  if (error || !data) {
    return [];
  }

  return data.map((row) => ({
    id: row.id,
    type: row.type,
    title: row.title,
    message: row.message,
    severity: row.severity,
    readAt: row.read_at,
    createdAt: row.created_at,
  }));
}

export async function getUnreadNotificationCount(): Promise<number> {
  const supabase = createClient();

  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);

  return count ?? 0;
}
