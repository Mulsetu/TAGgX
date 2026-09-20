import "server-only";
import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import { createR2Client, getR2Object } from "@/lib/r2/client";
import { createClient } from "@/lib/supabase/server";
import type { CompanyStorageUsage } from "./types";

interface CompanyIdRow {
  id: string;
}

interface StorageUsedRow {
  company_id: string;
  storage_used_bytes: number;
}

async function sumBytesUnderPrefix(prefix: string): Promise<number> {
  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) {
    throw new Error("Storage is not configured.");
  }

  const r2 = createR2Client();
  let total = 0;
  let continuationToken: string | undefined;

  do {
    const response = await r2.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }),
    );

    for (const object of response.Contents ?? []) {
      total += object.Size ?? 0;
    }

    continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
  } while (continuationToken);

  return total;
}

/**
 * Ground-truth per-company storage: lists objects under each company's
 * R2 prefix (`companies/{id}/`) and sums ContentLength. This is what the
 * super-admin storage table displays — the Postgres counter is reconciled
 * to this, not the other way around, so deletions made in the bucket
 * itself are reflected.
 *
 * Falls back to the increment-only counter if R2 isn't reachable.
 */
export async function getStorageUsageByCompany(): Promise<CompanyStorageUsage[]> {
  const supabase = createClient();
  const { data: companies, error } = await supabase.from("companies").select("id").returns<CompanyIdRow[]>();

  if (error || !companies) {
    return [];
  }

  try {
    return await Promise.all(
      companies.map(async (company) => ({
        companyId: company.id,
        totalBytes: await sumBytesUnderPrefix(`companies/${company.id}/`),
      })),
    );
  } catch {
    return getStorageUsedByCompany();
  }
}

/**
 * The increment-only per-company storage counter (bumped on upload).
 * Used as a fallback when R2 listing isn't available, and as the
 * "current" value when reconciling after an R2 listing.
 */
export async function getStorageUsedByCompany(): Promise<CompanyStorageUsage[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("company_settings")
    .select("company_id, storage_used_bytes")
    .returns<StorageUsedRow[]>();

  if (error || !data) {
    return [];
  }

  return data.map((row) => ({ companyId: row.company_id, totalBytes: row.storage_used_bytes }));
}

/** Bytes for a company-scoped object key, used by the public /api/media proxy. */
export async function getCompanyObject(key: string): Promise<{ body: Uint8Array; contentType: string } | null> {
  return getR2Object(key);
}
