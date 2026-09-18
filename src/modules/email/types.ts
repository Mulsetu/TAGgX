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

export interface EmailFormState {
  error: string | null;
  success?: string;
}
