import "server-only";
import { TAGX_LOGO_SRC, TAGX_TEAL } from "@/lib/brand";
import { getPublicSiteUrl } from "@/lib/site";

// The only file in this codebase that talks to Brevo. Every outward-facing
// function below funnels through sendTransactionalEmail(); nothing else
// should import "fetch" against api.brevo.com directly.

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

/** `simulated`: development mode — nothing was sent, the email was only logged. */
export type SendEmailResult = { messageId: string; simulated?: boolean } | { error: string };

/** Shown wherever a simulated send is reported, so "sent" never means "only logged". */
export const SIMULATED_EMAIL_NOTE =
  "Not delivered: this server is in development mode, so emails are only logged. Set SEND_REAL_EMAILS_IN_DEV=true to send real emails.";

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

/** True when emails really go out through Brevo (production, or opted in for dev). */
export function isEmailDeliveryLive(): boolean {
  return shouldSendReal();
}

async function sendTransactionalEmail(params: SendTransactionalEmailParams): Promise<SendEmailResult> {
  if (!shouldSendReal()) {
    // eslint-disable-next-line no-console
    console.log(
      `[dev email] to=${params.to.map((r) => r.email).join(",")} subject="${params.subject}"\n${params.textContent}`,
    );
    return { messageId: `dev-${Date.now()}`, simulated: true };
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

export interface EmailBrand {
  companyName: string;
  /** Absolute, publicly reachable URL — mail clients fetch it from their own servers. */
  logoUrl?: string | null;
  primaryColor?: string | null;
}

const HEX_COLOR = /^#[0-9a-f]{3,8}$/i;

/**
 * Table-based layout (what Gmail/Outlook render reliably): company logo or
 * name on top, a white card with the title, body and optional button, and a
 * short footer. No contact details — emails get forwarded, so the
 * workspace's phone/address/email never go in them.
 */
function renderLayout(title: string, bodyHtml: string, brand?: EmailBrand, cta?: { label: string; url: string }): string {
  const companyName = escapeHtml(brand?.companyName || "TagX");
  const accent = brand?.primaryColor && HEX_COLOR.test(brand.primaryColor) ? brand.primaryColor : TAGX_TEAL;
  const tagxLogo = `${getPublicSiteUrl()}${TAGX_LOGO_SRC}`;
  const header = brand?.logoUrl
    ? `<img src="${escapeHtml(brand.logoUrl)}" alt="${companyName}" height="40" style="display:block;height:40px;max-width:200px;border:0;font-size:18px;font-weight:600;color:${accent};" />`
    : brand
      ? `<span style="font-size:20px;font-weight:700;color:${accent};">${companyName}</span>`
      : `<img src="${escapeHtml(tagxLogo)}" alt="TagX" height="36" style="display:block;height:36px;border:0;font-size:20px;font-weight:700;color:${accent};" />`;
  const button = cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 4px;"><tr><td style="border-radius:8px;background:${accent};">
         <a href="${escapeHtml(cta.url)}" style="display:inline-block;padding:11px 20px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">${escapeHtml(cta.label)}</a>
       </td></tr></table>`
    : "";
  const footer = brand
    ? `You're receiving this because you're part of <strong>${companyName}</strong>.`
    : "You're receiving this because of your account.";

  return `<!doctype html>
<html>
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>${escapeHtml(title)}</title></head>
  <body style="margin:0;padding:0;background:#f4f6f8;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;">
      <tr><td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
          <tr><td style="padding:0 4px 20px;">${header}</td></tr>
          <tr><td style="background:#ffffff;border:1px solid #e5e7eb;border-top:4px solid ${accent};border-radius:12px;padding:28px 28px 24px;color:#1f2937;font-size:15px;line-height:1.6;">
            <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:#111827;">${escapeHtml(title)}</h1>
            ${bodyHtml}
            ${button}
          </td></tr>
          <tr><td style="padding:20px 4px 0;color:#6b7280;font-size:12px;line-height:1.5;">
            ${footer}
            <div style="margin-top:12px;">
              <a href="${getPublicSiteUrl()}" style="text-decoration:none;color:#9ca3af;">Powered by TagX</a>
            </div>
          </td></tr>
        </table>
      </td></tr>
    </table>
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
       <a href="${params.inviteUrl}" style="display:inline-block;padding:10px 16px;background:${TAGX_TEAL};color:#ffffff;border-radius:6px;text-decoration:none;">
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
// Self-serve signup: verify email
// ---------------------------------------------------------------------

export interface SignupVerificationEmailParams {
  to: string;
  recipientName?: string;
  verifyUrl: string;
}

export async function sendSignupVerificationEmail(
  params: SignupVerificationEmailParams,
): Promise<SendEmailResult> {
  const greeting = params.recipientName ? `Hi ${escapeHtml(params.recipientName)},` : "Hi,";

  const html = renderLayout(
    "Confirm your email",
    `<p>${greeting}</p>
     <p>Thanks for signing up for TagX. Confirm your email address to set up your company workspace and choose your plan.</p>
     <p>
       <a href="${params.verifyUrl}" style="display:inline-block;padding:10px 16px;background:${TAGX_TEAL};color:#ffffff;border-radius:6px;text-decoration:none;">
         Confirm email
       </a>
     </p>
     <p style="font-size: 13px; color: #737373;">Or paste this link into your browser: ${params.verifyUrl}</p>
     <p style="font-size: 13px; color: #737373;">If you didn't create a TagX account, you can ignore this email.</p>`,
  );

  return sendTransactionalEmail({
    to: [{ email: params.to, name: params.recipientName }],
    subject: "Confirm your email for TagX",
    htmlContent: html,
    textContent: `Thanks for signing up for TagX. Confirm your email to continue: ${params.verifyUrl}\n\nIf you didn't create a TagX account, ignore this email.`,
  });
}

// ---------------------------------------------------------------------
// Password reset
// ---------------------------------------------------------------------

export interface PasswordResetEmailParams {
  to: string;
  resetUrl: string;
}

export async function sendPasswordResetEmail(params: PasswordResetEmailParams): Promise<SendEmailResult> {
  const html = renderLayout(
    "Reset your password",
    `<p>Hi,</p>
     <p>We received a request to reset the password for your TagX account. This link expires in 1 hour.</p>
     <p>
       <a href="${params.resetUrl}" style="display:inline-block;padding:10px 16px;background:${TAGX_TEAL};color:#ffffff;border-radius:6px;text-decoration:none;">
         Choose a new password
       </a>
     </p>
     <p style="font-size: 13px; color: #737373;">Or paste this link into your browser: ${params.resetUrl}</p>
     <p style="font-size: 13px; color: #737373;">If you didn't ask for this, you can ignore this email — your password stays the same.</p>`,
  );

  return sendTransactionalEmail({
    to: [{ email: params.to }],
    subject: "Reset your TagX password",
    htmlContent: html,
    textContent: `Reset your TagX password (link expires in 1 hour): ${params.resetUrl}

If you didn't ask for this, ignore this email.`,
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

interface WorkspaceDeletionRequestParams {
  companyName: string;
  companySlug: string;
  requestedByEmail: string;
  reason: string | null;
  adminUrl: string;
}

/**
 * Notifies TagX staff that a Company Admin flagged their own workspace for
 * deletion (see modules/companies/actions.ts's requestWorkspaceDeletionAction).
 * The request itself is a row on `companies` and survives until a super
 * admin actually deletes the company — but that row (and everything else
 * about the tenant) is gone the moment that happens, since
 * company_id ... on delete cascade reaches audit_log too. This email is
 * the one record of the request that isn't inside the tenant's own data
 * and so isn't wiped out along with it.
 */
export async function sendWorkspaceDeletionRequestEmail(
  params: WorkspaceDeletionRequestParams,
): Promise<SendEmailResult> {
  const to = process.env.CRM_NOTIFY_EMAIL?.trim() || process.env.BREVO_FROM_EMAIL?.trim();
  if (!to) {
    return { error: "No notification inbox is configured." };
  }

  const html = renderLayout(
    `Deletion requested: ${escapeHtml(params.companyName)}`,
    `<p><strong>${escapeHtml(params.companyName)}</strong> (/${escapeHtml(params.companySlug)}) requested workspace deletion.</p>
     <p>Requested by: ${escapeHtml(params.requestedByEmail)}</p>
     ${params.reason ? `<p>Reason: ${escapeHtml(params.reason)}</p>` : ""}
     <p>Review and complete the delete from <a href="${params.adminUrl}">the admin companies list</a> — it is not automatic.</p>`,
  );

  return sendTransactionalEmail({
    to: [{ email: to }],
    subject: `TagX: deletion requested — ${params.companyName}`,
    htmlContent: html,
    textContent: `${params.companyName} (/${params.companySlug}) requested deletion, by ${params.requestedByEmail}. Review: ${params.adminUrl}`,
  });
}

export interface PlanChangeRequestParams {
  companyName: string;
  companySlug: string;
  requestedByEmail: string;
  currentPlan: string | null;
  requestedPlan: string;
  note: string | null;
  adminUrl: string;
}

/** Upgrade/downgrade request from a Company Admin — handled by the TagX team. */
export async function sendPlanChangeRequestEmail(params: PlanChangeRequestParams): Promise<SendEmailResult> {
  const to = process.env.CRM_NOTIFY_EMAIL?.trim() || process.env.BREVO_FROM_EMAIL?.trim();
  if (!to) {
    return { error: "No notification inbox is configured." };
  }

  const html = renderLayout(
    `Plan change requested: ${escapeHtml(params.companyName)}`,
    `<p><strong>${escapeHtml(params.companyName)}</strong> (/${escapeHtml(params.companySlug)}) wants to change plan.</p>
     <p>Current plan: ${escapeHtml(params.currentPlan ?? "none")}<br/>Requested plan: <strong>${escapeHtml(params.requestedPlan)}</strong></p>
     <p>Requested by: ${escapeHtml(params.requestedByEmail)}</p>
     ${params.note ? `<p>Note: ${escapeHtml(params.note)}</p>` : ""}
     <p>Assign the plan from <a href="${params.adminUrl}">the admin companies list</a>.</p>`,
  );

  return sendTransactionalEmail({
    to: [{ email: to }],
    subject: `TagX: plan change requested — ${params.companyName}`,
    htmlContent: html,
    textContent: `${params.companyName} (/${params.companySlug}) requested ${params.requestedPlan} (current: ${params.currentPlan ?? "none"}), by ${params.requestedByEmail}. ${params.note ?? ""} ${params.adminUrl}`,
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
  brand?: EmailBrand;
}): Promise<SendEmailResult> {
  const subject = interpolateTemplate(params.subject, params.vars, false);
  // Vars are escaped in the HTML body: asset names and ticket titles can come from public QR reports.
  const bodyHtml = interpolateTemplate(params.htmlBody, params.vars, true);
  const assetUrl = params.vars.asset_url;
  const cta = assetUrl && /^https?:\/\//i.test(assetUrl) ? { label: "View details", url: assetUrl } : undefined;
  const htmlContent = renderLayout(subject, bodyHtml, params.brand, cta);
  const textContent = interpolateTemplate(params.textBody, params.vars, false);
  return sendTransactionalEmail({
    to: [{ email: params.to, name: params.toName }],
    subject,
    htmlContent,
    textContent,
  });
}
