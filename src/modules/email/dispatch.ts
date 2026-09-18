import "server-only";
import { EMAIL_EVENT_MODULES } from "@/lib/permissions/feature-catalog";
import { resolveEnabledModulesForCompany } from "@/lib/permissions/features";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendTemplatedEmail } from "@/lib/email";
import { getCompanyByIdAdmin } from "@/modules/companies/queries";
import { mediaSrc } from "@/lib/media-url";
import { getCompanyAdminEmails } from "./queries";

interface TemplateRow {
  subject: string;
  html_body: string;
  text_body: string;
  is_enabled: boolean;
}

const FALLBACK: Record<string, { subject: string; html: string; text: string }> = {
  asset_assigned: {
    subject: "Asset assigned: {{asset_name}}",
    html: "<p>{{asset_name}} ({{asset_code}}) was assigned.</p>",
    text: "{{asset_name}} ({{asset_code}}) was assigned. {{asset_url}}",
  },
  asset_returned: {
    subject: "Asset returned: {{asset_name}}",
    html: "<p>{{asset_name}} was returned.</p>",
    text: "{{asset_name}} returned.",
  },
  asset_transferred: {
    subject: "Asset transferred: {{asset_name}}",
    html: "<p>{{asset_name}} was transferred.</p>",
    text: "{{asset_name}} transferred.",
  },
  vendor_assigned: {
    subject: "Vendor assignment: {{asset_name}}",
    html: "<p>{{vendor_name}} assigned to {{maintenance_title}}.</p>",
    text: "{{vendor_name}} assigned.",
  },
  maintenance_created: {
    subject: "Maintenance ticket: {{maintenance_title}}",
    html: "<p>Ticket created for {{asset_name}} ({{asset_code}}).</p><p><a href=\"{{asset_url}}\">Open asset</a></p>",
    text: "Ticket created for {{asset_name}} ({{asset_code}}). {{asset_url}}",
  },
  maintenance_assigned: {
    subject: "Maintenance assigned: {{maintenance_title}}",
    html: "<p>{{maintenance_title}} for {{asset_name}} was assigned.</p>",
    text: "{{maintenance_title}} assigned.",
  },
  transfer_pending: {
    subject: "Transfer pending: {{asset_name}}",
    html: "<p>{{asset_name}} ({{asset_code}}) is waiting for you to accept or reject a transfer.</p>",
    text: "{{asset_name}} transfer pending. {{asset_url}}",
  },
  transfer_accepted: {
    subject: "Transfer accepted: {{asset_name}}",
    html: "<p>The transfer of {{asset_name}} was accepted.</p>",
    text: "Transfer of {{asset_name}} accepted.",
  },
  transfer_rejected: {
    subject: "Transfer rejected: {{asset_name}}",
    html: "<p>The transfer of {{asset_name}} was rejected.</p>",
    text: "Transfer of {{asset_name}} rejected.",
  },
};

function contactLine(brand: {
  contactEmail: string | null;
  contactPhone: string | null;
  contactAddress: string | null;
}): string | null {
  const parts = [brand.contactEmail, brand.contactPhone, brand.contactAddress].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

function publicLogoUrl(logoUrl: string | null): string | null {
  if (!logoUrl) {
    return null;
  }
  if (logoUrl.startsWith("http://") || logoUrl.startsWith("https://")) {
    return logoUrl;
  }
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  const path = mediaSrc(logoUrl);
  return path && appUrl ? `${appUrl}${path}` : path;
}

export async function dispatchEventEmail(params: {
  companyId: string;
  eventKey: string;
  entityId: string;
  occurrenceKey: string;
  extraRecipients?: { email: string; name?: string | null }[];
  vars: Record<string, string>;
}): Promise<void> {
  const moduleKey = EMAIL_EVENT_MODULES[params.eventKey];
  if (moduleKey) {
    const enabled = await resolveEnabledModulesForCompany(params.companyId);
    if (!enabled[moduleKey] || !enabled.email) {
      return;
    }
  } else {
    const enabled = await resolveEnabledModulesForCompany(params.companyId);
    if (!enabled.email) {
      return;
    }
  }

  const supabase = createAdminClient();
  const { data: template } = await supabase
    .from("email_templates")
    .select("subject, html_body, text_body, is_enabled")
    .eq("company_id", params.companyId)
    .eq("event_key", params.eventKey)
    .maybeSingle<TemplateRow>();

  if (template && !template.is_enabled) {
    return;
  }

  const fallback = FALLBACK[params.eventKey];
  const subject = template?.subject ?? fallback?.subject ?? params.eventKey;
  const htmlBody = template?.html_body ?? fallback?.html ?? "<p>{{asset_name}}</p>";
  const textBody = template?.text_body ?? fallback?.text ?? "{{asset_name}}";

  const brandRow = await getCompanyByIdAdmin(params.companyId);
  const brand = brandRow
    ? {
        companyName: brandRow.name,
        logoUrl: publicLogoUrl(brandRow.logoUrl),
        contactLine: contactLine(brandRow),
        primaryColor: brandRow.primaryColor,
      }
    : undefined;
  const brandedVars = {
    ...params.vars,
    organization_name: brandRow?.name ?? params.vars.organization_name ?? "TagX",
  };
  const admins = await getCompanyAdminEmails(params.companyId);
  const recipients = [...admins, ...(params.extraRecipients ?? [])];
  const seen = new Set<string>();

  for (const recipient of recipients) {
    const email = recipient.email.trim().toLowerCase();
    if (!email || seen.has(email)) {
      continue;
    }
    seen.add(email);

    const { error } = await supabase.from("notification_logs").insert({
      company_id: params.companyId,
      event_key: params.eventKey,
      entity_id: params.entityId,
      occurrence_key: params.occurrenceKey,
      recipient_email: email,
      status: "pending",
      template_vars: brandedVars,
    });
    if (error) {
      continue;
    }

    const result = await sendTemplatedEmail({
      to: email,
      toName: recipient.name ?? undefined,
      subject,
      htmlBody,
      textBody,
      vars: brandedVars,
      brand,
    });

    await supabase
      .from("notification_logs")
      .update({
        status: "error" in result ? "failed" : "sent",
        error: "error" in result ? result.error : null,
      })
      .eq("company_id", params.companyId)
      .eq("event_key", params.eventKey)
      .eq("occurrence_key", params.occurrenceKey)
      .eq("recipient_email", email);
  }
}

interface FailedLogRow {
  id: string;
  company_id: string;
  event_key: string;
  entity_id: string | null;
  occurrence_key: string;
  recipient_email: string;
  error: string | null;
  template_vars: Record<string, string> | null;
}

function retryAttempts(error: string | null): number {
  const match = error?.match(/^attempts=(\d+)\|/);
  if (!match?.[1]) {
    return 1;
  }
  return Number.parseInt(match[1], 10);
}

function isStringVars(value: unknown): value is Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  return Object.values(value).every((entry) => typeof entry === "string");
}

/** Re-sends failed log rows in place so unique occurrence keys can succeed after a transient Brevo error. */
export async function retryFailedNotificationEmails(): Promise<{ retried: number; sent: number }> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("notification_logs")
    .select("id, company_id, event_key, entity_id, occurrence_key, recipient_email, error, template_vars")
    .eq("status", "failed")
    .returns<FailedLogRow[]>();

  let retried = 0;
  let sent = 0;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  for (const row of data ?? []) {
    const attempts = retryAttempts(row.error);
    if (attempts >= 5) {
      continue;
    }
    retried += 1;

    const { data: template } = await supabase
      .from("email_templates")
      .select("subject, html_body, text_body, is_enabled")
      .eq("company_id", row.company_id)
      .eq("event_key", row.event_key)
      .maybeSingle<TemplateRow>();

    if (template && !template.is_enabled) {
      continue;
    }

    const fallback = FALLBACK[row.event_key];
    const subject = template?.subject ?? fallback?.subject ?? row.event_key;
    const htmlBody = template?.html_body ?? fallback?.html ?? "<p>{{asset_name}}</p>";
    const textBody = template?.text_body ?? fallback?.text ?? "{{asset_name}}";
    const vars = isStringVars(row.template_vars)
      ? row.template_vars
      : {
          asset_name: row.event_key,
          asset_code: "",
          due_date: "",
          asset_url: appUrl,
          maintenance_title: row.event_key,
          vendor_name: "",
          organization_name: "",
        };

    const brandRow = await getCompanyByIdAdmin(row.company_id);
    const result = await sendTemplatedEmail({
      to: row.recipient_email,
      subject,
      htmlBody,
      textBody,
      vars,
      brand: brandRow
        ? {
            companyName: brandRow.name,
            logoUrl: publicLogoUrl(brandRow.logoUrl),
            contactLine: contactLine(brandRow),
            primaryColor: brandRow.primaryColor,
          }
        : undefined,
    });

    const nextAttempts = attempts + 1;
    if ("error" in result) {
      await supabase
        .from("notification_logs")
        .update({
          status: "failed",
          error: `attempts=${nextAttempts}|${result.error}`,
          sent_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      continue;
    }

    await supabase
      .from("notification_logs")
      .update({
        status: "sent",
        error: null,
        sent_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    sent += 1;
  }

  return { retried, sent };
}
