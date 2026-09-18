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

export const MAINTENANCE_PRIORITIES = ["low", "normal", "high", "emergency"] as const;
export type MaintenancePriority = (typeof MAINTENANCE_PRIORITIES)[number];

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
  vendorId: string | null;
  priority: MaintenancePriority;
  dueAt: string | null;
  typeKey: string;
  openedAt: string;
  resolvedAt: string | null;
}

export interface MaintenanceFormState {
  error: string | null;
}

export interface MaintenancePlanSummary {
  id: string;
  name: string;
  assetId: string;
  frequency: string;
  nextDueAt: string;
  isActive: boolean;
  vendorId: string | null;
  assignedTo: string | null;
  checklist: string | null;
  estimatedCost: number | null;
  instructions: string | null;
  intervalDays: number | null;
}
