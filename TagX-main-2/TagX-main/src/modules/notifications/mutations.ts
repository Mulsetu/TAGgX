import "server-only";
import { createClient } from "@/lib/supabase/server";

export type NotificationMutationResult = { error: string | null };

/**
 * Session-scoped client, not admin: RLS's notifications_tenant_mark_read
 * policy (0025_notifications_mark_read.sql) already confines this to rows
 * in the caller's own company.
 */
export async function markNotificationRead(id: string): Promise<NotificationMutationResult> {
  const supabase = createClient();

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id);

  return { error: error ? "Could not update notification." : null };
}

export async function markAllNotificationsRead(): Promise<NotificationMutationResult> {
  const supabase = createClient();

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);

  return { error: error ? "Could not update notifications." : null };
}
