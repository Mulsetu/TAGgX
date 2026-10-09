"use server";

import "server-only";
import { requirePermission } from "@/lib/permissions/has-permission";
import { listAuditLog } from "./queries";
import type { AuditLogPage } from "./types";
import { activityQuerySchema } from "./validation";

export async function getAuditLogForAdmin(
  rawSearchParams: Record<string, string | string[] | undefined>,
): Promise<AuditLogPage> {
  const { area, page } = activityQuerySchema.parse({ area: rawSearchParams.area, page: rawSearchParams.page });
  if (!(await requirePermission("settings", "view"))) {
    return { items: [], totalCount: 0, page, pageSize: 25, area };
  }
  return listAuditLog(area, page);
}
