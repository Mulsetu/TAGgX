export interface AuditLogEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  actorId: string | null;
  actorName: string | null;
  createdAt: string;
  oldValues: unknown;
  newValues: unknown;
}

export const ACTIVITY_AREAS = ["all", "assets", "custody", "maintenance", "people", "settings", "billing"] as const;
export type ActivityArea = (typeof ACTIVITY_AREAS)[number];

export const ACTIVITY_AREA_LABELS: Record<ActivityArea, string> = {
  all: "All",
  assets: "Assets",
  custody: "Custody",
  maintenance: "Maintenance",
  people: "People & roles",
  settings: "Settings",
  billing: "Billing",
};

/** Action-name prefixes per area (audit_log.action is "<entity>.<verb>"). */
export const ACTIVITY_AREA_PREFIXES: Record<Exclude<ActivityArea, "all">, string[]> = {
  assets: ["asset.created", "asset.updated", "asset.deleted", "asset.restored", "asset.disposed", "asset.document", "assets."],
  custody: ["asset.handover", "asset.return", "asset.transfer"],
  maintenance: ["maintenance"],
  people: ["user.", "role."],
  settings: ["settings.", "email_template.", "status.", "condition.", "vendor.", "company."],
  billing: ["payment.", "plan.", "subscription."],
};

export interface AuditLogPage {
  items: AuditLogEntry[];
  totalCount: number;
  page: number;
  pageSize: number;
  area: ActivityArea;
}
