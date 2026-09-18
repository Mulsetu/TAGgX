import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { HandoverInput, ReturnInput, TransferInput } from "./validation";

export async function insertLifecycleEvent(params: {
  companyId: string;
  assetId: string;
  eventType: string;
  summary: string;
  payload?: Record<string, unknown>;
  actorId: string | null;
}): Promise<void> {
  const supabase = createClient();
  await supabase.from("asset_lifecycle_events").insert({
    company_id: params.companyId,
    asset_id: params.assetId,
    event_type: params.eventType,
    summary: params.summary,
    payload: params.payload ?? {},
    actor_id: params.actorId,
  });
}

export async function insertHandover(
  companyId: string,
  createdBy: string,
  fromUserId: string | null,
  input: HandoverInput,
): Promise<{ id: string } | { error: string }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("asset_handovers")
    .insert({
      company_id: companyId,
      asset_id: input.assetId,
      from_user_id: fromUserId,
      to_user_id: input.toUserId,
      handed_over_at: input.handedOverAt,
      accessories: input.accessories ?? null,
      notes: input.notes ?? null,
      created_by: createdBy,
    })
    .select("id")
    .single<{ id: string }>();
  if (error || !data) {
    return { error: "Could not record the handover." };
  }
  return data;
}

export async function acknowledgeHandover(id: string, userId: string): Promise<{ error: string | null }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("asset_handovers")
    .update({ acknowledged_at: new Date().toISOString(), acknowledged_by: userId })
    .eq("id", id)
    .eq("to_user_id", userId)
    .is("acknowledged_at", null)
    .select("id")
    .maybeSingle<{ id: string }>();
  if (error || !data) {
    return { error: "Could not acknowledge this handover." };
  }
  return { error: null };
}

export async function insertReturn(
  companyId: string,
  createdBy: string,
  fromUserId: string | null,
  input: ReturnInput,
): Promise<{ id: string } | { error: string }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("asset_returns")
    .insert({
      company_id: companyId,
      asset_id: input.assetId,
      from_user_id: fromUserId,
      returned_at: input.returnedAt,
      condition_key: input.conditionKey ?? null,
      damage_remarks: input.damageRemarks ?? null,
      missing_accessories: input.missingAccessories ?? null,
      created_by: createdBy,
    })
    .select("id")
    .single<{ id: string }>();
  if (error || !data) {
    return { error: "Could not record the return." };
  }
  return data;
}

export async function insertTransfer(
  companyId: string,
  createdBy: string,
  fromUserId: string | null,
  fromLocationId: string | null,
  input: TransferInput,
  options?: { immediate?: boolean },
): Promise<{ id: string } | { error: string }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("asset_transfers")
    .insert({
      company_id: companyId,
      asset_id: input.assetId,
      from_user_id: fromUserId,
      to_user_id: input.toUserId ?? null,
      from_location_id: fromLocationId,
      to_location_id: input.toLocationId ?? null,
      reason: input.reason ?? null,
      transferred_at: input.transferredAt,
      status: input.toUserId && !options?.immediate ? "pending" : "accepted",
      acknowledged_at: input.toUserId && !options?.immediate ? null : new Date().toISOString(),
      acknowledged_by: input.toUserId && !options?.immediate ? null : createdBy,
      created_by: createdBy,
    })
    .select("id")
    .single<{ id: string }>();
  if (error || !data) {
    return { error: "Could not record the transfer." };
  }
  return data;
}

export async function updateAssetCustody(params: {
  assetId: string;
  allottedTo: string | null;
  allotmentDate: string | null;
  locationId?: string;
  condition?: string | null;
}): Promise<{ error: string | null }> {
  const supabase = createClient();
  const patch: Record<string, unknown> = {
    allotted_to: params.allottedTo,
    allotment_date: params.allotmentDate,
  };
  if (params.locationId) {
    patch.location_id = params.locationId;
  }
  if (params.condition !== undefined) {
    patch.condition = params.condition;
  }
  const { error } = await supabase.from("assets").update(patch).eq("id", params.assetId);
  return { error: error ? "Could not update the asset." : null };
}

export async function getTransferById(id: string): Promise<{
  id: string;
  assetId: string;
  toUserId: string | null;
  fromUserId: string | null;
  toLocationId: string | null;
  fromLocationId: string | null;
  transferredAt: string;
  status: string;
} | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("asset_transfers")
    .select("id, asset_id, to_user_id, from_user_id, to_location_id, from_location_id, transferred_at, status")
    .eq("id", id)
    .maybeSingle<{
      id: string;
      asset_id: string;
      to_user_id: string | null;
      from_user_id: string | null;
      to_location_id: string | null;
      from_location_id: string | null;
      transferred_at: string;
      status: string;
    }>();
  if (!data) {
    return null;
  }
  return {
    id: data.id,
    assetId: data.asset_id,
    toUserId: data.to_user_id,
    fromUserId: data.from_user_id,
    toLocationId: data.to_location_id,
    fromLocationId: data.from_location_id,
    transferredAt: data.transferred_at,
    status: data.status,
  };
}

export async function acceptTransfer(id: string, userId: string): Promise<{ error: string | null }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("asset_transfers")
    .update({
      status: "accepted",
      acknowledged_at: new Date().toISOString(),
      acknowledged_by: userId,
    })
    .eq("id", id)
    .eq("to_user_id", userId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle<{ id: string }>();
  if (error || !data) {
    return { error: "Could not accept this transfer." };
  }
  return { error: null };
}

export async function rejectTransfer(
  id: string,
  userId: string,
  reason?: string,
): Promise<{ error: string | null }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("asset_transfers")
    .update({
      status: "rejected",
      rejected_at: new Date().toISOString(),
      rejection_reason: reason ?? null,
      acknowledged_by: userId,
    })
    .eq("id", id)
    .eq("to_user_id", userId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle<{ id: string }>();
  if (error || !data) {
    return { error: "Could not reject this transfer." };
  }
  return { error: null };
}
