import "server-only";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";

// R2 is S3-compatible: same client, just a different endpoint ("auto"
// region, account-scoped URL) and R2-specific access keys instead of AWS
// ones.
export function createR2Client(): S3Client {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("R2 credentials are not configured");
  }

  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

/**
 * Public URL for an object key, assuming the bucket is served publicly
 * (custom domain or the pub-*.r2.dev one) rather than via signed URLs —
 * same assumption already documented on companies.logo_url. Falls back to
 * the bare key if R2_PUBLIC_URL isn't set, so callers always get a string
 * back even in a not-fully-configured environment.
 */
export function buildR2PublicUrl(key: string): string {
  const publicUrl = process.env.R2_PUBLIC_URL;
  return publicUrl ? `${publicUrl.replace(/\/$/, "")}/${key}` : key;
}

/**
 * Inverse of buildR2PublicUrl: turns a stored image_url (public URL or
 * bare key) back into the R2 object key so we can delete the object.
 */
export function r2KeyFromStoredValue(value: string): string {
  const trimmed = value.trim();

  if (trimmed.startsWith("/api/media/")) {
    return trimmed
      .slice("/api/media/".length)
      .split("/")
      .map((segment) => decodeURIComponent(segment))
      .join("/");
  }

  const publicUrl = process.env.R2_PUBLIC_URL?.replace(/\/$/, "");
  if (publicUrl && trimmed.startsWith(`${publicUrl}/`)) {
    return trimmed.slice(publicUrl.length + 1);
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      const path = new URL(trimmed).pathname.replace(/^\//, "");
      if (path.startsWith("companies/")) {
        return path;
      }
    } catch {
      return trimmed;
    }
  }

  return trimmed;
}

const COMPANY_OBJECT_KEY = /^companies\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/.+/i;

export function isCompanyObjectKey(key: string): boolean {
  return COMPANY_OBJECT_KEY.test(key) && !key.includes("..");
}

function contentTypeFromKey(key: string): string {
  const lower = key.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".ico")) return "image/x-icon";
  return "application/octet-stream";
}

export async function getR2Object(key: string): Promise<{ body: Uint8Array; contentType: string } | null> {
  if (!isCompanyObjectKey(key)) {
    return null;
  }

  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) {
    return null;
  }

  try {
    const r2 = createR2Client();
    const response = await r2.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const body = await response.Body?.transformToByteArray();
    if (!body) {
      return null;
    }

    return {
      body,
      contentType: response.ContentType || contentTypeFromKey(key),
    };
  } catch {
    return null;
  }
}
