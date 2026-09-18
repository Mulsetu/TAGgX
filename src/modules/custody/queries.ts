import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { LifecycleEvent } from "./types";

interface EventRow {
  id: string;
  event_type: string;
  summary: string;
  created_at: string;
}

export async function listLifecycleEvents(assetId: string): Promise<LifecycleEvent[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("asset_lifecycle_events")
    .select("id, event_type, summary, created_at")
    .eq("asset_id", assetId)
    .order("created_at", { ascending: false })
    .limit(50)
    .returns<EventRow[]>();

  return (data ?? []).map((row) => ({
    id: row.id,
    eventType: row.event_type,
    summary: row.summary,
    createdAt: row.created_at,
  }));
}

export async function getPendingHandoverForUser(assetId: string, userId: string): Promise<{ id: string } | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("asset_handovers")
    .select("id")
    .eq("asset_id", assetId)
    .eq("to_user_id", userId)
    .is("acknowledged_at", null)
    .order("created_at", { ascending: false })
    .maybeSingle<{ id: string }>();
  return data ?? null;
}

interface TransferRow {
  id: string;
  to_user_id: string | null;
  from_user_id: string | null;
  status: string;
  reason: string | null;
  transferred_at: string;
}

export async function getPendingTransferForAsset(assetId: string): Promise<{
  id: string;
  toUserId: string | null;
  fromUserId: string | null;
  status: "pending";
  reason: string | null;
  transferredAt: string;
} | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("asset_transfers")
    .select("id, to_user_id, from_user_id, status, reason, transferred_at")
    .eq("asset_id", assetId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .maybeSingle<TransferRow>();
  if (!data) {
    return null;
  }
  return {
    id: data.id,
    toUserId: data.to_user_id,
    fromUserId: data.from_user_id,
    status: "pending",
    reason: data.reason,
    transferredAt: data.transferred_at,
  };
}
