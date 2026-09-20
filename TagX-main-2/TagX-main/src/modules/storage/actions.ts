"use server";

import "server-only";
import { isCurrentUserSuperAdmin } from "@/lib/permissions/super-admin";
import { isCompanyObjectKey } from "@/lib/r2/client";
import { getCompanyObject, getStorageUsageByCompany, getStorageUsedByCompany } from "./queries";
import { reconcileStorageUsed } from "./mutations";
import type { CompanyStorageUsage } from "./types";

/** Per-company storage usage for the super-admin storage table. */
export async function getStorageUsageForAdmin(): Promise<CompanyStorageUsage[]> {
  if (!(await isCurrentUserSuperAdmin())) {
    return [];
  }

  const usage = await getStorageUsageByCompany();
  const counters = await getStorageUsedByCompany();
  const currentByCompany = new Map(counters.map((entry) => [entry.companyId, entry.totalBytes]));

  await Promise.all(
    usage.map((entry) =>
      reconcileStorageUsed(entry.companyId, currentByCompany.get(entry.companyId) ?? 0, entry.totalBytes),
    ),
  );

  return usage;
}

/**
 * Public image/logo bytes for /api/media. Keys are unguessable UUIDs under
 * companies/{id}/ — the tag page and favicon load them without a session.
 */
export async function getCompanyMediaObject(
  key: string,
): Promise<{ body: Uint8Array; contentType: string } | null> {
  if (!isCompanyObjectKey(key)) {
    return null;
  }

  return getCompanyObject(key);
}
