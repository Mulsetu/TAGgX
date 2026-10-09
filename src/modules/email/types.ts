export interface AdminRecipient {
  email: string;
  name: string | null;
}

export interface EmailBatchResult {
  sent: number;
  failed: number;
}

export interface EmailTemplateSummary {
  id: string;
  eventKey: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  isEnabled: boolean;
}

export interface NotificationRuleSummary {
  id: string;
  eventKey: string;
  offsetDays: number;
  recipient: string;
  isEnabled: boolean;
}

export interface NotificationLogSummary {
  id: string;
  eventKey: string;
  recipientEmail: string;
  status: string;
  sentAt: string;
  error: string | null;
}

export type EmailEventGroup = "custody" | "maintenance" | "reminders";

export const EMAIL_EVENT_GROUPS: { id: EmailEventGroup; title: string; description: string }[] = [
  { id: "custody", title: "Custody & transfers", description: "When assets change hands." },
  { id: "maintenance", title: "Maintenance", description: "Tickets created, assigned and due." },
  { id: "reminders", title: "Expiry reminders", description: "Sent ahead of warranty, AMC, insurance and document dates." },
];

/** Friendly name + one line of context for each email event. */
export const EMAIL_EVENT_META: Record<string, { label: string; description: string; group: EmailEventGroup }> = {
  asset_assigned: { label: "Asset assigned", description: "An asset is handed over to someone.", group: "custody" },
  asset_returned: { label: "Asset returned", description: "Someone returns an asset.", group: "custody" },
  asset_transferred: { label: "Asset transferred", description: "An asset moves to another person or place.", group: "custody" },
  transfer_pending: { label: "Transfer waiting", description: "A transfer needs to be accepted.", group: "custody" },
  transfer_accepted: { label: "Transfer accepted", description: "The receiver accepted a transfer.", group: "custody" },
  transfer_rejected: { label: "Transfer rejected", description: "The receiver rejected a transfer.", group: "custody" },
  maintenance_created: { label: "Ticket created", description: "A maintenance ticket is opened.", group: "maintenance" },
  maintenance_assigned: { label: "Ticket assigned", description: "A ticket is given to someone.", group: "maintenance" },
  vendor_assigned: { label: "Vendor assigned", description: "A vendor is put on a ticket.", group: "maintenance" },
  maintenance_due: { label: "Maintenance due", description: "Planned maintenance is coming up.", group: "maintenance" },
  warranty_expiry: { label: "Warranty ending", description: "An asset's warranty is about to end.", group: "reminders" },
  amc_expiry: { label: "AMC ending", description: "An AMC contract is about to end.", group: "reminders" },
  insurance_expiry: { label: "Insurance ending", description: "Insurance cover is about to end.", group: "reminders" },
  document_expiry: { label: "Document expiring", description: "An attached document is about to expire.", group: "reminders" },
};

export function emailEventLabel(eventKey: string): string {
  return EMAIL_EVENT_META[eventKey]?.label ?? eventKey.replace(/_/g, " ").replace(/^\w/, (char) => char.toUpperCase());
}

export interface EmailFormState {
  error: string | null;
  success?: string;
}
