import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { AssetCondition } from "@/modules/assets/types";
import type { AuditExceptionType, AuditItemStatus } from "./types";
import type { AssetSnapshot } from "./queries";
import type { CreateAuditInput, RecordAuditScanInput } from "./validation";

export type AuditMutationResult = { id: string } | { error: string };

interface CreateAuditParams {
  companyId: string;
  createdBy: string;
  input: CreateAuditInput;
  locationName: string | null;
  snapshots: AssetSnapshot[];
}

export async function createAuditWithItems(params: CreateAuditParams): Promise<AuditMutationResult> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("audits")
    .insert({
      company_id: params.companyId,
      name: params.input.name,
      scheduled_date: params.input.scheduledDate,
      location_id: params.input.locationId ?? null,
      location_name: params.locationName,
      status: "draft",
      created_by: params.createdBy,
      require_photo_on_exception: params.input.requirePhotoOnException ?? false,
      require_remark_on_exception: params.input.requireRemarkOnException ?? false,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    return { error: "Could not create the audit." };
  }

  const rows = params.snapshots.map((asset) => ({
    company_id: params.companyId,
    audit_id: data.id,
    asset_id: asset.id,
    asset_name: asset.name,
    asset_code: asset.assetCode,
    expected_location_id: asset.locationId,
    expected_location_name: asset.locationName,
    expected_condition: asset.condition,
    status: "unverified",
    exception_types: [],
  }));

  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100);
    const { error: itemError } = await supabase.from("audit_items").insert(chunk);
    if (itemError) {
      await supabase.from("audits").delete().eq("id", data.id);
      return { error: "Could not add assets to this audit." };
    }
  }

  return { id: data.id };
}

export async function startAudit(id: string): Promise<{ error: string | null }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("audits")
    .update({ status: "active", started_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "draft")
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error) {
    return { error: "Could not start the audit." };
  }
  if (!data) {
    return { error: "Only a draft audit can be started." };
  }
  return { error: null };
}

export async function completeAudit(id: string): Promise<{ error: string | null }> {
  const supabase = createClient();

  const { data: audit } = await supabase
    .from("audits")
    .select("id")
    .eq("id", id)
    .eq("status", "active")
    .maybeSingle<{ id: string }>();

  if (!audit) {
    return { error: "Only an active audit can be completed." };
  }

  const { error: flagError } = await supabase
    .from("audit_items")
    .update({
      status: "exception",
      exception_types: ["missing"],
      resolved: false,
    })
    .eq("audit_id", id)
    .eq("status", "unverified");

  if (flagError) {
    return { error: "Could not flag missing assets." };
  }

  const { data, error } = await supabase
    .from("audits")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "active")
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error) {
    return { error: "Could not complete the audit." };
  }
  if (!data) {
    return { error: "Only an active audit can be completed." };
  }
  return { error: null };
}

export async function deleteDraftAudit(id: string): Promise<{ error: string | null }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("audits")
    .delete()
    .eq("id", id)
    .eq("status", "draft")
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error) {
    return { error: "Could not delete the audit." };
  }
  if (!data) {
    return { error: "Completed and active audits are kept for history. Only drafts can be deleted." };
  }
  return { error: null };
}

function evaluateScan(input: {
  expectedLocationId: string | null;
  expectedCondition: AssetCondition | null;
  foundLocationId: string | undefined;
  foundCondition: AssetCondition | undefined;
  extraExceptionTypes?: string[];
  expectedCustodianId?: string | null;
  foundCustodianId?: string;
}): { status: AuditItemStatus; exceptionTypes: AuditExceptionType[] } {
  const exceptionTypes: AuditExceptionType[] = [];
  const foundLocation = input.foundLocationId ?? null;
  if (input.expectedLocationId && foundLocation && input.expectedLocationId !== foundLocation) {
    exceptionTypes.push("wrong_location");
  }
  if (input.expectedCondition && input.foundCondition && input.expectedCondition !== input.foundCondition) {
    exceptionTypes.push("condition_mismatch");
  }
  if (
    input.expectedCustodianId &&
    input.foundCustodianId &&
    input.expectedCustodianId !== input.foundCustodianId
  ) {
    exceptionTypes.push("wrong_custodian");
  }
  for (const extra of input.extraExceptionTypes ?? []) {
    if (!exceptionTypes.includes(extra)) {
      exceptionTypes.push(extra);
    }
  }
  if (exceptionTypes.length > 0) {
    return { status: "exception", exceptionTypes };
  }
  return { status: "verified", exceptionTypes: [] };
}

export async function recordAuditScan(params: {
  auditId: string;
  assetId: string;
  userId: string;
  input: RecordAuditScanInput;
  expectedLocationId: string | null;
  expectedCondition: AssetCondition | null;
  foundLocationName: string | null;
  exceptionPhotoPath?: string | null;
  expectedCustodianId?: string | null;
}): Promise<{ error: string | null; status: AuditItemStatus; exceptionTypes: AuditExceptionType[] }> {
  const evaluated = evaluateScan({
    expectedLocationId: params.expectedLocationId,
    expectedCondition: params.expectedCondition,
    foundLocationId: params.input.foundLocationId,
    foundCondition: params.input.foundCondition,
    extraExceptionTypes: params.input.extraExceptionTypes,
    expectedCustodianId: params.expectedCustodianId,
    foundCustodianId: params.input.foundCustodianId,
  });

  const supabase = createClient();
  const { data, error } = await supabase
    .from("audit_items")
    .update({
      status: evaluated.status,
      exception_types: evaluated.exceptionTypes,
      found_location_id: params.input.foundLocationId ?? null,
      found_location_name: params.foundLocationName,
      found_condition: params.input.foundCondition ?? null,
      notes: params.input.notes ?? null,
      scanned_at: new Date().toISOString(),
      scanned_by: params.userId,
      resolved: false,
      resolved_at: null,
      resolved_by: null,
      resolution_notes: null,
      exception_photo_path: params.exceptionPhotoPath ?? null,
      found_custodian_id: params.input.foundCustodianId ?? null,
    })
    .eq("audit_id", params.auditId)
    .eq("asset_id", params.assetId)
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error) {
    return { error: "Could not record this scan.", status: "unverified", exceptionTypes: [] };
  }
  if (!data) {
    return { error: "That asset is not in this audit.", status: "unverified", exceptionTypes: [] };
  }

  return { error: null, status: evaluated.status, exceptionTypes: evaluated.exceptionTypes };
}

export async function markAuditItemMissing(
  auditId: string,
  itemId: string,
  exceptionPhotoPath?: string | null,
): Promise<{ error: string | null }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("audit_items")
    .update({
      status: "exception",
      exception_types: ["missing"],
      resolved: false,
      exception_photo_path: exceptionPhotoPath ?? null,
    })
    .eq("id", itemId)
    .eq("audit_id", auditId)
    .eq("status", "unverified")
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error) {
    return { error: "Could not mark this asset missing." };
  }
  if (!data) {
    return { error: "Only unverified assets can be marked missing." };
  }
  return { error: null };
}

export async function resolveAuditItem(
  itemId: string,
  userId: string,
  resolutionNotes: string,
): Promise<{ error: string | null }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("audit_items")
    .update({
      resolved: true,
      resolved_at: new Date().toISOString(),
      resolved_by: userId,
      resolution_notes: resolutionNotes,
    })
    .eq("id", itemId)
    .eq("status", "exception")
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error) {
    return { error: "Could not save the resolution." };
  }
  if (!data) {
    return { error: "Only exceptions can be resolved." };
  }
  return { error: null };
}
