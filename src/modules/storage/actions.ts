"use server";

import "server-only";
import { isCurrentUserSuperAdmin } from "@/lib/permissions/super-admin";
import { createClient } from "@/lib/supabase/server";
import { companyIdFromObjectKey, isCompanyObjectKey, isPublicCompanyMediaKey } from "@/lib/r2/client";
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

export interface CompanyMediaObject {
  body: Uint8Array;
  contentType: string;
  cacheControl: string;
}

/**
 * Logos and public tag images stay anonymous. Attachments and other
 * private objects require a same-company session (or super admin).
 */
export async function getCompanyMediaObject(key: string): Promise<CompanyMediaObject | null> {
  if (!isCompanyObjectKey(key)) {
    return null;
  }

  const object = await getCompanyObject(key);
  if (!object) {
    return null;
  }

  if (isPublicCompanyMediaKey(key)) {
    return { ...object, cacheControl: "public, max-age=3600" };
  }

  const keyCompanyId = companyIdFromObjectKey(key);
  if (!keyCompanyId) {
    return null;
  }

  if (await isCurrentUserSuperAdmin()) {
    return { ...object, cacheControl: "private, no-store" };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .maybeSingle<{ company_id: string }>();

  if (!profile || profile.company_id !== keyCompanyId) {
    return null;
  }

  return { ...object, cacheControl: "private, no-store" };
}
