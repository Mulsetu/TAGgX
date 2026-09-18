import "server-only";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { TENANT_HEADERS } from "@/lib/tenant";
import { getSubscriptionForCompany } from "@/modules/billing/queries";
import type { SubscriptionStatus } from "@/modules/billing/types";

const READ_ONLY_STATUSES: SubscriptionStatus[] = ["pending_payment", "past_due", "halted", "canceled"];

export const TENANT_READ_ONLY_MESSAGE =
  "This workspace is read-only until billing is active. You can still manage Settings.";

export interface TenantAccessState {
  writable: boolean;
  suspended: boolean;
  subscriptionStatus: SubscriptionStatus | "none";
}

async function getCompanySuspended(companyId: string): Promise<boolean> {
  const supabase = createClient();
  const { data } = await supabase
    .from("companies")
    .select("suspended_at")
    .eq("id", companyId)
    .maybeSingle<{ suspended_at: string | null }>();
  return data?.suspended_at != null;
}

export async function getTenantAccessState(): Promise<TenantAccessState> {
  const companyId = headers().get(TENANT_HEADERS.companyId);
  if (!companyId) {
    return { writable: false, suspended: false, subscriptionStatus: "none" };
  }

  const [suspended, subscription] = await Promise.all([
    getCompanySuspended(companyId),
    getSubscriptionForCompany(companyId),
  ]);

  const subscriptionStatus = subscription?.status ?? "none";
  const billingBlocked =
    subscriptionStatus !== "none" &&
    (READ_ONLY_STATUSES as readonly string[]).includes(subscriptionStatus);

  return {
    writable: !suspended && !billingBlocked,
    suspended,
    subscriptionStatus,
  };
}

/** Blocks tenant writes except billing/settings. Super-admin /admin actions skip this. */
export async function requireWritableTenant(): Promise<boolean> {
  const access = await getTenantAccessState();
  return access.writable;
}
