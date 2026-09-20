import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AdminRecipient } from "./types";

interface RoleIdRow {
  id: string;
}

interface UserContactRow {
  email: string;
  full_name: string | null;
}

/**
 * Who should receive company-wide system emails (storage warnings, due
 * reminders). Heuristic, not an authorization check: there's no
 * dedicated "billing/admin contact" flag on users yet, so this just looks
 * for roles that read like an owner/admin role. Fine for "who gets
 * warned about storage" — not a substitute for a real permission check.
 */
export async function getCompanyAdminEmails(companyId: string): Promise<AdminRecipient[]> {
  const supabase = createAdminClient();

  const { data: adminRoles } = await supabase
    .from("roles")
    .select("id")
    .eq("company_id", companyId)
    .or("name.ilike.%admin%,name.ilike.%owner%")
    .returns<RoleIdRow[]>();

  const roleIds = (adminRoles ?? []).map((role) => role.id);
  if (roleIds.length === 0) {
    return [];
  }

  const { data: users, error } = await supabase
    .from("users")
    .select("email, full_name")
    .eq("company_id", companyId)
    .in("role_id", roleIds)
    .returns<UserContactRow[]>();

  if (error || !users) {
    return [];
  }

  return users.map((row) => ({ email: row.email, name: row.full_name }));
}

interface PendingStorageNotificationRow {
  id: string;
  company_id: string;
  threshold_percent: number | null;
}

export interface PendingStorageNotification {
  id: string;
  companyId: string;
  thresholdPercent: number;
}

/**
 * The "outbox": storage_threshold notifications inserted by
 * check_storage_thresholds() (pg_cron) that haven't been emailed yet —
 * see supabase/migrations/0019_notifications_emailed_at.sql. Postgres can
 * insert the notification row but can't call the Brevo API itself.
 */
export async function getUnemailedStorageThresholdNotifications(): Promise<PendingStorageNotification[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("notifications")
    .select("id, company_id, threshold_percent")
    .eq("type", "storage_threshold")
    .is("emailed_at", null)
    .returns<PendingStorageNotificationRow[]>();

  if (error || !data) {
    return [];
  }

  return data
    .filter((row) => row.threshold_percent !== null)
    .map((row) => ({
      id: row.id,
      companyId: row.company_id,
      thresholdPercent: row.threshold_percent as number,
    }));
}

export async function markNotificationEmailed(id: string): Promise<void> {
  const supabase = createAdminClient();
  await supabase.from("notifications").update({ emailed_at: new Date().toISOString() }).eq("id", id);
}

interface CompanyStorageInfoRow {
  storage_used_bytes: number;
  storage_limit_bytes: number;
}

export interface CompanyStorageInfo {
  name: string;
  storageUsedBytes: number;
  storageLimitBytes: number;
}

export async function getCompanyStorageInfo(companyId: string): Promise<CompanyStorageInfo | null> {
  const supabase = createAdminClient();

  const [{ data: company }, { data: settings }] = await Promise.all([
    supabase.from("companies").select("name").eq("id", companyId).maybeSingle<{ name: string }>(),
    supabase
      .from("company_settings")
      .select("storage_used_bytes, storage_limit_bytes")
      .eq("company_id", companyId)
      .maybeSingle<CompanyStorageInfoRow>(),
  ]);

  if (!company || !settings) {
    return null;
  }

  return {
    name: company.name,
    storageUsedBytes: settings.storage_used_bytes,
    storageLimitBytes: settings.storage_limit_bytes,
  };
}
