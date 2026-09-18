import "server-only";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { TENANT_HEADERS } from "@/lib/tenant";
import { getRequestAuthUser } from "@/lib/supabase/server";

export async function writeAuditLog(input: {
  action: string;
  entityType: string;
  entityId?: string | null;
  oldValues?: unknown;
  newValues?: unknown;
  companyId?: string | null;
}): Promise<void> {
  const companyId = input.companyId ?? headers().get(TENANT_HEADERS.companyId);
  if (!companyId) {
    return;
  }

  const actor = await getRequestAuthUser();
  const forwarded = headers().get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || headers().get("x-real-ip")?.trim() || null;

  const supabase = createAdminClient();
  await supabase.from("audit_log").insert({
    company_id: companyId,
    actor_id: actor?.id ?? null,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    old_values: input.oldValues ?? null,
    new_values: input.newValues ?? null,
    ip_address: ip,
  });
}
