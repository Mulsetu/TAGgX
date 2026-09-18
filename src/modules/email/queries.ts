import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type {
  AdminRecipient,
  EmailTemplateSummary,
  NotificationLogSummary,
  NotificationRuleSummary,
} from "./types";

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

interface TemplateRow {
  id: string;
  event_key: string;
  subject: string;
  html_body: string;
  text_body: string;
  is_enabled: boolean;
}

export async function listEmailTemplates(): Promise<EmailTemplateSummary[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("email_templates")
    .select("id, event_key, subject, html_body, text_body, is_enabled")
    .order("event_key")
    .returns<TemplateRow[]>();
  return (data ?? []).map((row) => ({
    id: row.id,
    eventKey: row.event_key,
    subject: row.subject,
    htmlBody: row.html_body,
    textBody: row.text_body,
    isEnabled: row.is_enabled,
  }));
}

interface RuleRow {
  id: string;
  event_key: string;
  offset_days: number;
  recipient: string;
  is_enabled: boolean;
}

export async function listNotificationRules(): Promise<NotificationRuleSummary[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("notification_rules")
    .select("id, event_key, offset_days, recipient, is_enabled")
    .order("event_key")
    .order("offset_days")
    .returns<RuleRow[]>();
  return (data ?? []).map((row) => ({
    id: row.id,
    eventKey: row.event_key,
    offsetDays: row.offset_days,
    recipient: row.recipient,
    isEnabled: row.is_enabled,
  }));
}

export async function listEnabledNotificationRulesAdmin(): Promise<(NotificationRuleSummary & { companyId: string })[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("notification_rules")
    .select("id, company_id, event_key, offset_days, recipient, is_enabled")
    .eq("is_enabled", true)
    .returns<(RuleRow & { company_id: string })[]>();
  return (data ?? []).map((row) => ({
    id: row.id,
    companyId: row.company_id,
    eventKey: row.event_key,
    offsetDays: row.offset_days,
    recipient: row.recipient,
    isEnabled: row.is_enabled,
  }));
}

interface LogRow {
  id: string;
  event_key: string;
  recipient_email: string;
  status: string;
  sent_at: string;
  error: string | null;
}

export async function listRecentNotificationLogs(limit = 50): Promise<NotificationLogSummary[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("notification_logs")
    .select("id, event_key, recipient_email, status, sent_at, error")
    .order("sent_at", { ascending: false })
    .limit(limit)
    .returns<LogRow[]>();
  return (data ?? []).map((row) => ({
    id: row.id,
    eventKey: row.event_key,
    recipientEmail: row.recipient_email,
    status: row.status,
    sentAt: row.sent_at,
    error: row.error,
  }));
}

export interface DatedAssetReminder {
  id: string;
  companyId: string;
  name: string;
  assetCode: string;
  dueDate: string;
}

export async function listAssetsDueOn(
  companyId: string,
  column: "warranty_end_date" | "amc_end_date" | "insurance_expiry_date",
  dueDate: string,
): Promise<DatedAssetReminder[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("assets")
    .select("id, company_id, name, asset_code")
    .eq("company_id", companyId)
    .eq(column, dueDate)
    .returns<{ id: string; company_id: string; name: string; asset_code: string }[]>();
  return (data ?? []).map((row) => ({
    id: row.id,
    companyId: row.company_id,
    name: row.name,
    assetCode: row.asset_code,
    dueDate,
  }));
}

export async function listTicketsDueOn(companyId: string, dueDate: string): Promise<DatedAssetReminder[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("maintenance_tickets")
    .select("id, company_id, title, due_at, assets(name, asset_code)")
    .eq("company_id", companyId)
    .eq("due_at", dueDate)
    .in("status", ["open", "in_progress"])
    .returns<
      {
        id: string;
        company_id: string;
        title: string;
        due_at: string;
        assets: { name: string; asset_code: string } | { name: string; asset_code: string }[] | null;
      }[]
    >();
  return (data ?? []).map((row) => {
    const asset = Array.isArray(row.assets) ? row.assets[0] : row.assets;
    return {
      id: row.id,
      companyId: row.company_id,
      name: asset?.name ?? row.title,
      assetCode: asset?.asset_code ?? "",
      dueDate: row.due_at,
    };
  });
}

export async function listDocumentsDueOn(companyId: string, dueDate: string): Promise<DatedAssetReminder[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("asset_documents")
    .select("id, company_id, expires_at, assets(id, name, asset_code)")
    .eq("company_id", companyId)
    .eq("expires_at", dueDate)
    .returns<
      {
        id: string;
        company_id: string;
        expires_at: string;
        assets: { id: string; name: string; asset_code: string } | { id: string; name: string; asset_code: string }[] | null;
      }[]
    >();
  return (data ?? []).map((row) => {
    const asset = Array.isArray(row.assets) ? row.assets[0] : row.assets;
    return {
      id: row.id,
      companyId: row.company_id,
      name: asset?.name ?? "Document",
      assetCode: asset?.asset_code ?? "",
      dueDate: row.expires_at,
    };
  });
}
