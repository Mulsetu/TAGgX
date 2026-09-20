const UUID_PATH = /^\/(?:assets|tag)\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Post-login redirect targets from a `?next=` query. Rejects protocol-
 * relative URLs, other hosts, and any path that isn't an in-app page we
 * explicitly allow — so a crafted login link can't bounce someone off-site.
 */
export function safePostLoginPath(raw: string | string[] | undefined): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return null;
  }

  if (value === "/dashboard" || UUID_PATH.test(value)) {
    return value;
  }

  return null;
}
