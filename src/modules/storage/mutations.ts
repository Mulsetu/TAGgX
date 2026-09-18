import "server-only";
import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import type { ReadableStream as NodeWebReadableStream } from "node:stream/web";
import { DeleteObjectCommand, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { buildR2PublicUrl, createR2Client } from "@/lib/r2/client";
import { createClient } from "@/lib/supabase/server";
import { EXTENSION_BY_MIME, inspectUploadFile } from "./validation";
import type { UploadFileResult } from "./types";

/**
 * Virus-scan hook — STUB. Deliberately takes metadata only, not the
 * file's bytes: a real scanner (ClamAV sidecar, Cloudflare's own
 * scanning, VirusTotal, etc.) for files this size typically runs
 * asynchronously after upload (scan-on-write via a queue/webhook), not by
 * buffering the whole file in this request just to pre-scan it — that
 * would defeat the point of streaming the upload straight through to R2.
 * Swap the body for a real call when a scanner is chosen; the call sites
 * below don't need to change.
 */
export async function scanFileForViruses(meta: {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}): Promise<{ clean: boolean; reason?: string }> {
  void meta;
  return { clean: true };
}

interface UploadFileParams {
  companyId: string;
  folder: string;
  file: File;
}

/**
 * Validates, scans, and streams a file straight through to R2 (no
 * buffering the whole file in memory), then bumps the company's
 * storage_used_bytes counter via the adjust_storage_used RPC — atomic
 * even under concurrent uploads (see
 * supabase/migrations/0018_storage_and_notifications.sql).
 */
export async function uploadFileToR2({ companyId, folder, file }: UploadFileParams): Promise<UploadFileResult> {
  const inspected = await inspectUploadFile(file);
  if ("error" in inspected) {
    return { error: inspected.error };
  }

  const scanResult = await scanFileForViruses({
    fileName: file.name,
    mimeType: inspected.mimeType,
    sizeBytes: file.size,
  });
  if (!scanResult.clean) {
    return { error: "This file failed a security scan and was not uploaded." };
  }

  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) {
    return { error: "Storage is not configured." };
  }

  const supabase = createClient();
  const { data: settings } = await supabase
    .from("company_settings")
    .select("storage_used_bytes, storage_limit_bytes")
    .eq("company_id", companyId)
    .maybeSingle<{ storage_used_bytes: number; storage_limit_bytes: number }>();
  if (
    settings &&
    settings.storage_limit_bytes > 0 &&
    settings.storage_used_bytes + file.size > settings.storage_limit_bytes
  ) {
    return { error: "This upload would exceed your company's storage limit." };
  }

  const extension = EXTENSION_BY_MIME[inspected.mimeType];
  const key = `companies/${companyId}/${folder}/${randomUUID()}${extension ? `.${extension}` : ""}`;

  try {
    const r2 = createR2Client();
    // File.stream() -> Node Readable: streams straight through to R2
    // instead of buffering the file into memory first.
    const body = Readable.fromWeb(file.stream() as unknown as NodeWebReadableStream<Uint8Array>);

    await r2.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: inspected.mimeType,
        ContentLength: file.size,
      }),
    );
  } catch {
    return { error: "Could not upload the file." };
  }

  await supabase.rpc("adjust_storage_used", { p_company_id: companyId, p_delta: file.size });

  return { key, url: buildR2PublicUrl(key), sizeBytes: file.size, mimeType: inspected.mimeType };
}

interface DeleteFileParams {
  key: string;
  sizeBytes?: number;
}

/**
 * Best-effort R2 delete + storage-counter decrement. Missing objects or
 * a misconfigured bucket must not fail the caller's DB delete — leftover
 * objects are reconciled the next time the super-admin storage page
 * lists the prefix.
 */
export async function deleteFilesFromR2(companyId: string, files: DeleteFileParams[]): Promise<void> {
  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket || files.length === 0) {
    return;
  }

  let r2;
  try {
    r2 = createR2Client();
  } catch {
    return;
  }

  const prefix = `companies/${companyId}/`;
  let freedBytes = 0;

  for (const file of files) {
    if (!file.key.startsWith(prefix)) {
      continue;
    }

    try {
      let size = file.sizeBytes ?? 0;
      if (size <= 0) {
        const head = await r2.send(new HeadObjectCommand({ Bucket: bucket, Key: file.key }));
        size = head.ContentLength ?? 0;
      }
      await r2.send(new DeleteObjectCommand({ Bucket: bucket, Key: file.key }));
      freedBytes += size;
    } catch {
      // Object already gone, or R2 unreachable — continue with the rest.
    }
  }

  if (freedBytes > 0) {
    const supabase = createClient();
    await supabase.rpc("adjust_storage_used", { p_company_id: companyId, p_delta: -freedBytes });
  }
}

/**
 * Brings company_settings.storage_used_bytes in line with a just-listed
 * R2 total. Uses the existing adjust_storage_used RPC (delta = actual -
 * current) so we don't need a second "set absolute" function, and so a
 * concurrent upload's increment isn't clobbered by a blind overwrite.
 */
export async function reconcileStorageUsed(companyId: string, currentBytes: number, actualBytes: number): Promise<void> {
  const delta = actualBytes - currentBytes;
  if (delta === 0) {
    return;
  }

  const supabase = createClient();
  await supabase.rpc("adjust_storage_used", { p_company_id: companyId, p_delta: delta });
}
