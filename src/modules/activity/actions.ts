"use server";

import "server-only";
import { requirePermission } from "@/lib/permissions/has-permission";
import { listAuditLog } from "./queries";
import type { AuditLogEntry } from "./types";

export async function getAuditLogForAdmin(): Promise<AuditLogEntry[]> {
  if (!(await requirePermission("settings", "view"))) {
    return [];
  }
  return listAuditLog(100);
}
