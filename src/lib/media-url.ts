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
    return stored;
  }

  return `/api/media/${key.split("/").map(encodeURIComponent).join("/")}`;
}
