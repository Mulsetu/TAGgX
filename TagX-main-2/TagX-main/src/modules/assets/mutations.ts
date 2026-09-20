import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { AssetFormInput } from "./validation";
import type { CustomFieldValue } from "@/modules/categories/types";

export type AssetMutationResult = { id: string } | { error: string };

interface PostgrestErrorLike {
  code?: string;
}

function friendlyError(error: PostgrestErrorLike | null): string {
  if (error?.code === "23505") {
    return "This asset code is already in use.";
  }
  return "Could not save the asset.";
}

function buildAssetFields(input: AssetFormInput, customFields: Record<string, CustomFieldValue>) {
  return {
    name: input.name,
    image_url: input.imageUrl ?? null,
    category_id: input.categoryId,
    location_id: input.locationId,
    cwip_invoice_id: input.cwipInvoiceId ?? null,
    status_id: input.statusId,
    condition: input.condition ?? null,
    brand: input.brand ?? null,
    model: input.model ?? null,
    linked_asset_id: input.linkedAssetId ?? null,
    description: input.description ?? null,
    serial_number: input.serialNumber ?? null,
    vendor: input.vendor ?? null,
    po_number: input.poNumber ?? null,
    invoice_date: input.invoiceDate ?? null,
    invoice_number: input.invoiceNumber ?? null,
    purchase_date: input.purchaseDate ?? null,
    purchase_price: input.purchasePrice ?? null,
    ownership_type: input.ownershipType,
    partner_name: input.partnerName ?? null,
    allotted_to: input.allottedTo ?? null,
    allotment_date: input.allotmentDate ?? null,
    warranty_start_date: input.warrantyStartDate ?? null,
    warranty_end_date: input.warrantyEndDate ?? null,
    amc_provider: input.amcProvider ?? null,
    amc_start_date: input.amcStartDate ?? null,
    amc_end_date: input.amcEndDate ?? null,
    insurance_provider: input.insuranceProvider ?? null,
    insurance_policy_number: input.insurancePolicyNumber ?? null,
    insurance_expiry_date: input.insuranceExpiryDate ?? null,
    custom_fields: customFields,
  };
}

interface CreateAssetParams {
  companyId: string;
  createdBy: string;
  assetCode: string;
  input: AssetFormInput;
  customFields: Record<string, CustomFieldValue>;
}

export async function createAsset({
  companyId,
  createdBy,
  assetCode,
  input,
  customFields,
}: CreateAssetParams): Promise<AssetMutationResult> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("assets")
    .insert({
      company_id: companyId,
      created_by: createdBy,
      asset_code: assetCode,
      ...buildAssetFields(input, customFields),
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    return { error: friendlyError(error) };
  }

  return { id: data.id };
}

export async function updateAsset(
  id: string,
  assetCode: string,
  input: AssetFormInput,
  customFields: Record<string, CustomFieldValue>,
): Promise<AssetMutationResult> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("assets")
    .update({ asset_code: assetCode, ...buildAssetFields(input, customFields) })
    .eq("id", id)
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    return { error: friendlyError(error) };
  }

  return { id: data.id };
}

export async function markQrGenerated(id: string): Promise<{ error: string | null }> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("assets")
    .update({ qr_generated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error) {
    return { error: "Could not save the QR tag." };
  }
  if (!data) {
    return { error: "Asset not found." };
  }

  return { error: null };
}

/**
 * Deletes the asset row. Postgres cascades asset_documents and
 * maintenance_tickets, and SET NULLs linked_asset_id on other assets
 * (see 0011 / 0015 / 0017). R2 objects are cleaned up by the caller.
 */
export async function deleteAsset(id: string): Promise<{ error: string | null }> {
  const supabase = createClient();

  const { data, error } = await supabase.from("assets").delete().eq("id", id).select("id").maybeSingle<{ id: string }>();

  if (error) {
    return { error: "Could not delete the asset." };
  }
  if (!data) {
    return { error: "Asset not found." };
  }

  return { error: null };
}

// The optional group and the required literal "d" can't both match the
// same characters, so this backtracks linearly, not exponentially.
// eslint-disable-next-line security/detect-unsafe-regex
const CODE_FORMAT_PATTERN = /\{SEQ(?::0?(\d+)d)?\}/;

function formatAssetCode(format: string, sequence: number): string {
  return format.replace(CODE_FORMAT_PATTERN, (_match, width: string | undefined) => {
    return width ? String(sequence).padStart(Number(width), "0") : String(sequence);
  });
}

/**
 * Hands out the next auto-generated asset code for a company, using
 * `company_settings.asset_code_format` (e.g. 'AST-{SEQ:05d}') and the
 * `increment_asset_sequence` RPC, which atomically bumps the per-company
 * counter (see supabase/migrations/0017_assets_field_redesign.sql) — safe
 * even if two asset creations happen at the same time.
 */
export async function generateAssetCode(companyId: string): Promise<string> {
  const supabase = createClient();

  const [{ data: settings }, { data: sequence }] = await Promise.all([
    supabase
      .from("company_settings")
      .select("asset_code_format")
      .eq("company_id", companyId)
      .maybeSingle<{ asset_code_format: string }>(),
    supabase.rpc("increment_asset_sequence", { p_company_id: companyId }),
  ]);

  const format = settings?.asset_code_format ?? "AST-{SEQ:05d}";
  return formatAssetCode(format, Number(sequence));
}

interface CreateAssetDocumentParams {
  companyId: string;
  assetId: string;
  uploadedBy: string;
  fileName: string;
  filePath: string;
  fileSizeBytes: number;
  mimeType: string;
}

export async function createAssetDocument(
  params: CreateAssetDocumentParams,
): Promise<AssetMutationResult> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("asset_documents")
    .insert({
      company_id: params.companyId,
      asset_id: params.assetId,
      uploaded_by: params.uploadedBy,
      file_name: params.fileName,
      file_path: params.filePath,
      file_size_bytes: params.fileSizeBytes,
      mime_type: params.mimeType,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    return { error: "Could not save the attachment." };
  }

  return { id: data.id };
}

export async function recordAssetLocationMove(params: {
  companyId: string;
  assetId: string;
  userId: string;
  fromLocationId: string | null;
  toLocationId: string | null;
  fromLocationPath: string | null;
  toLocationPath: string | null;
}): Promise<void> {
  if (params.fromLocationId === params.toLocationId) {
    return;
  }

  const supabase = createClient();
  await supabase.from("asset_location_history").insert({
    company_id: params.companyId,
    asset_id: params.assetId,
    from_location_id: params.fromLocationId,
    to_location_id: params.toLocationId,
    from_location_path: params.fromLocationPath,
    to_location_path: params.toLocationPath,
    moved_by: params.userId,
  });
}
