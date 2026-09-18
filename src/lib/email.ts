import "server-only";
import { TAGX_LOGO_SRC } from "@/lib/brand";
import { getSiteUrl } from "@/lib/site";

// The only file in this codebase that talks to Brevo. Every outward-facing
// function below funnels through sendTransactionalEmail(); nothing else
// should import "fetch" against api.brevo.com directly.

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

export type SendEmailResult = { messageId: string } | { error: string };

interface EmailRecipient {
  email: string;
  name?: string;
}

interface SendTransactionalEmailParams {
  to: EmailRecipient[];
  subject: string;
  htmlContent: string;
  textContent: string;
}

// In development, Brevo is never actually called unless explicitly opted
// into via SEND_REAL_EMAILS_IN_DEV=true — the caller gets a fake success
// back and the would-be email is logged instead. Callers that have a URL
// worth showing a tester directly (e.g. an invite link) should surface it
// in their own response regardless of this flag; this only controls
// whether Brevo's API gets hit.
function shouldSendReal(): boolean {
  return process.env.NODE_ENV === "production" || process.env.SEND_REAL_EMAILS_IN_DEV === "true";
}

async function sendTransactionalEmail(params: SendTransactionalEmailParams): Promise<SendEmailResult> {
  if (!shouldSendReal()) {
    // eslint-disable-next-line no-console
    console.log(
      `[dev email] to=${params.to.map((r) => r.email).join(",")} subject="${params.subject}"\n${params.textContent}`,
    );
    return { messageId: `dev-${Date.now()}` };
  }

  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_FROM_EMAIL;
  const senderName = process.env.BREVO_FROM_NAME ?? "TagX";

  if (!apiKey || !senderEmail) {
    return { error: "Email is not configured." };
  }

  try {
    const response = await fetch(BREVO_API_URL, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify({
        sender: { email: senderEmail, name: senderName },
        to: params.to,
        subject: params.subject,
        htmlContent: params.htmlContent,
        textContent: params.textContent,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      return { error: `Brevo API error (${response.status}): ${body.slice(0, 300)}` };
    }

    const data = (await response.json()) as { messageId: string };
    return { messageId: data.messageId };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not send email." };
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderLayout(
  title: string,
  bodyHtml: string,
  brand?: {
    companyName: string;
    logoUrl?: string | null;
    contactLine?: string | null;
    primaryColor?: string | null;
  },
): string {
  const companyName = brand?.companyName || "TagX";
  const accent = brand?.primaryColor || "#171717";
  const logoSrc = brand?.logoUrl || `${getSiteUrl()}${TAGX_LOGO_SRC}`;
  const logo = `<img src="${escapeHtml(logoSrc)}" alt="${escapeHtml(companyName)}" style="max-height:48px;max-width:220px;margin-bottom:16px;" />`;
  const contact = brand?.contactLine
    ? `<p style="color:#737373;font-size:12px;margin:8px 0 0;">${escapeHtml(brand.contactLine)}</p>`
    : "";
  return `<!doctype html>
<html>
  <body style="font-family: -apple-system, sans-serif; color: #171717; max-width: 480px; margin: 0 auto; padding: 24px 16px;">
    ${logo}
    <h1 style="font-size: 18px; margin: 0 0 16px; color: ${escapeHtml(accent)};">${escapeHtml(title)}</h1>
    ${bodyHtml}
    <p style="color: #737373; font-size: 12px; margin-top: 32px;">${escapeHtml(companyName)}</p>
    ${contact}
  </body>
</html>`;
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  // exponent is clamped to [0, units.length - 1] above, so this index is
  // always in range — not user-controlled key access.
  // eslint-disable-next-line security/detect-object-injection
  const unit = units[exponent];
  return `${(bytes / 1024 ** exponent).toFixed(1)} ${unit}`;
}

// ---------------------------------------------------------------------
// User invite
// ---------------------------------------------------------------------

export interface UserInviteEmailParams {
  to: string;
  recipientName?: string;
  companyName: string;
  inviteUrl: string;
  invitedByName?: string;
}

export async function sendUserInviteEmail(params: UserInviteEmailParams): Promise<SendEmailResult> {
  const greeting = params.recipientName ? `Hi ${escapeHtml(params.recipientName)},` : "Hi,";
  const inviter = params.invitedByName ? ` by ${escapeHtml(params.invitedByName)}` : "";
  const companyName = escapeHtml(params.companyName);

  const html = renderLayout(
    `You've been invited to ${companyName}`,
    `<p>${greeting}</p>
     <p>You've been invited${inviter} to join <strong>${companyName}</strong> on TagX.</p>
     <p>
       <a href="${params.inviteUrl}" style="display:inline-block;padding:10px 16px;background:#171717;color:#fafafa;border-radius:6px;text-decoration:none;">
         Accept invitation
       </a>
     </p>
     <p style="font-size: 13px; color: #737373;">Or paste this link into your browser: ${params.inviteUrl}</p>`,
  );

  return sendTransactionalEmail({
    to: [{ email: params.to, name: params.recipientName }],
    subject: `You've been invited to ${params.companyName} on TagX`,
    htmlContent: html,
    textContent: `You've been invited${inviter} to join ${params.companyName} on TagX.\n\nAccept your invitation: ${params.inviteUrl}`,
  });
}

// ---------------------------------------------------------------------
// Storage warning
// ---------------------------------------------------------------------

export interface StorageWarningEmailParams {
  to: string;
  recipientName?: string;
  companyName: string;
  usedBytes: number;
  limitBytes: number;
  thresholdPercent: number;
}

export async function sendStorageWarningEmail(params: StorageWarningEmailParams): Promise<SendEmailResult> {
  const greeting = params.recipientName ? `Hi ${escapeHtml(params.recipientName)},` : "Hi,";
  const companyName = escapeHtml(params.companyName);
  const isCritical = params.thresholdPercent >= 95;
  const used = formatBytes(params.usedBytes);
  const limit = formatBytes(params.limitBytes);

  const html = renderLayout(
    isCritical ? "Storage almost full" : "Storage usage high",
    `<p>${greeting}</p>
     <p><strong>${companyName}</strong> has used ${used} of its ${limit} storage limit
     (${params.thresholdPercent}%).</p>
     <p>${
       isCritical
         ? "New uploads may start failing once the limit is reached."
         : "Consider reviewing stored files, or upgrading your plan, before it fills up."
     }</p>`,
  );

  return sendTransactionalEmail({
    to: [{ email: params.to, name: params.recipientName }],
    subject: `${params.companyName}: storage at ${params.thresholdPercent}%`,
    htmlContent: html,
    textContent: `${params.companyName} has used ${used} of ${limit} (${params.thresholdPercent}%) of its storage limit.`,
  });
}

// ---------------------------------------------------------------------
// Maintenance / warranty due reminder
// ---------------------------------------------------------------------

export type ReminderReason = "warranty" | "amc" | "insurance" | "maintenance";

const REMINDER_LABELS: Record<ReminderReason, string> = {
  warranty: "Warranty",
  amc: "AMC",
  insurance: "Insurance",
  maintenance: "Maintenance",
};

export interface MaintenanceReminderEmailParams {
  to: string;
  recipientName?: string;
  assetName: string;
  assetCode: string;
  reason: ReminderReason;
  /** ISO date (warranty/amc/insurance expiry) or ISO datetime (ticket opened_at). */
  dueDate: string;
  assetUrl: string;
}

export async function sendMaintenanceReminderEmail(
  params: MaintenanceReminderEmailParams,
): Promise<SendEmailResult> {
  const greeting = params.recipientName ? `Hi ${escapeHtml(params.recipientName)},` : "Hi,";
  const label = REMINDER_LABELS[params.reason];
  const assetName = escapeHtml(params.assetName);
  const assetCode = escapeHtml(params.assetCode);
  const isTicket = params.reason === "maintenance";

  const bodyLine = isTicket
    ? `<strong>${assetName}</strong> (${assetCode}) has an open maintenance ticket since ${escapeHtml(params.dueDate)}.`
    : `<strong>${assetName}</strong> (${assetCode})'s ${label.toLowerCase()} is due on ${escapeHtml(params.dueDate)}.`;

  const html = renderLayout(
    `${label} due soon: ${params.assetName}`,
    `<p>${greeting}</p>
     <p>${bodyLine}</p>
     <p><a href="${params.assetUrl}">View asset</a></p>`,
  );

  return sendTransactionalEmail({
    to: [{ email: params.to, name: params.recipientName }],
    subject: `${label} due soon: ${params.assetName} (${params.assetCode})`,
    htmlContent: html,
    textContent: `${params.assetName} (${params.assetCode}) — ${label.toLowerCase()} due ${params.dueDate}. ${params.assetUrl}`,
  });
}

// ---------------------------------------------------------------------
// CRM lead notification (super-admin inbox)
// ---------------------------------------------------------------------

export interface CrmLeadNotificationParams {
  source: "demo" | "inquire";
  fullName: string;
  email: string;
  phone: string | null;
  companyName: string | null;
  message: string | null;
  preferredDate: string | null;
  adminUrl: string;
}

export async function sendCrmLeadNotificationEmail(
  params: CrmLeadNotificationParams,
): Promise<SendEmailResult> {
  const to = process.env.CRM_NOTIFY_EMAIL?.trim() || process.env.BREVO_FROM_EMAIL?.trim();
  if (!to) {
    return { error: "No CRM notification inbox is configured." };
  }

  const kind = params.source === "demo" ? "Demo request" : "Inquiry";
  const company = params.companyName ? escapeHtml(params.companyName) : "Not provided";
  const html = renderLayout(
    `${kind} from ${escapeHtml(params.fullName)}`,
    `<p><strong>${kind}</strong> landed in the TagX CRM.</p>
     <p>Name: ${escapeHtml(params.fullName)}<br/>
     Email: ${escapeHtml(params.email)}<br/>
     Phone: ${escapeHtml(params.phone ?? "—")}<br/>
     Company: ${company}<br/>
     Preferred date: ${escapeHtml(params.preferredDate ?? "—")}</p>
     ${params.message ? `<p>${escapeHtml(params.message)}</p>` : ""}
     <p><a href="${params.adminUrl}">Open leads in admin</a></p>`,
  );

  return sendTransactionalEmail({
    to: [{ email: to }],
    subject: `TagX CRM: ${kind} — ${params.fullName}`,
    htmlContent: html,
    textContent: `${kind} from ${params.fullName} <${params.email}>. Open: ${params.adminUrl}`,
  });
}

export function interpolateTemplate(template: string, vars: Record<string, string>, html: boolean): string {
  return template.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_match, key: string) => {
    const value = vars[key] ?? "";
    return html ? escapeHtml(value) : value;
  });
}

export async function sendTemplatedEmail(params: {
  to: string;
  toName?: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  vars: Record<string, string>;
  brand?: {
    companyName: string;
    logoUrl?: string | null;
    contactLine?: string | null;
    primaryColor?: string | null;
  };
}): Promise<SendEmailResult> {
  const subject = interpolateTemplate(params.subject, params.vars, false);
  const htmlContent = renderLayout(subject, interpolateTemplate(params.htmlBody, params.vars, false), params.brand);
  const textContent = interpolateTemplate(params.textBody, params.vars, false);
  return sendTransactionalEmail({
    to: [{ email: params.to, name: params.toName }],
    subject,
    htmlContent,
    textContent,
  });
}
