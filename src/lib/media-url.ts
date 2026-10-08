/**
 * Turns a stored R2 object key (or a previously saved public R2 URL) into
 * an app-origin `/api/media/...` src so <img> tags work even when the
 * bucket isn't publicly readable and even when R2_PUBLIC_URL isn't set.
 * Blob previews and already-proxied paths are left alone.
 */
export function mediaSrc(stored: string | null | undefined): string | null {
  if (!stored) {
    return null;
  }

  if (stored.startsWith("blob:") || stored.startsWith("/api/media/")) {
    return stored;
  }

  let key = stored.trim();

  if (key.startsWith("http://") || key.startsWith("https://")) {
    try {
      key = new URL(key).pathname.replace(/^\//, "");
    } catch {
      return stored;
    }
  }

  if (!key.startsWith("companies/") || key.includes("..")) {
    return driveImageSrc(stored);
  }

  return `/api/media/${key.split("/").map(encodeURIComponent).join("/")}`;
}

/** True when the stored value is an uploaded file, not a pasted link. */
export function isHostedAssetImage(stored: string | null | undefined): boolean {
  return mediaSrc(stored)?.startsWith("/api/media/") ?? false;
}

/** Pasted Drive (or other https) link. Uploaded files stay out of this field. */
export function externalImageLink(stored: string | null | undefined): string {
  if (!stored || (!stored.startsWith("http://") && !stored.startsWith("https://"))) {
    return "";
  }
  return isHostedAssetImage(stored) ? "" : stored;
}

/** Drive share links are not image URLs. Use the file id so a preview can load. */
function driveImageSrc(stored: string): string {
  const match = stored.match(/drive\.google\.com\/file\/d\/([^/?#]+)/);
  if (!match?.[1]) {
    return stored;
  }
  return `https://drive.google.com/uc?export=view&id=${match[1]}`;
}
