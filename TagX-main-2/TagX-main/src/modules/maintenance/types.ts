export interface OpenTicketCount {
  label: string;
  count: number;
}

export interface StaleTicketReminder {
  ticketId: string;
  companyId: string;
  assetId: string;
  assetName: string;
  assetCode: string;
  title: string;
  openedAt: string;
}

export const MAINTENANCE_STATUSES = ["open", "in_progress", "resolved", "cancelled"] as const;
export type MaintenanceStatus = (typeof MAINTENANCE_STATUSES)[number];

export interface MaintenanceTicketSummary {
  id: string;
  title: string;
  description: string | null;
  status: MaintenanceStatus;
  assetId: string;
  assetName: string;
  assetCode: string;
  reportedByName: string | null;
  assignedToId: string | null;
  assignedToName: string | null;
  openedAt: string;
  resolvedAt: string | null;
}

export interface MaintenanceFormState {
  error: string | null;
}
