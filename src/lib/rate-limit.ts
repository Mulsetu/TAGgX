/**
 * Process-local sliding window. Fine for a single Node instance (dev, or
 * one production server). Not shared across multiple instances — swap for
 * Redis/Upstash if the app is horizontally scaled (TAGX-019).
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function consumeRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (existing.count >= limit) {
    return false;
  }

  existing.count += 1;
  return true;
}

export function clientIpFromHeaders(headerList: { get(name: string): string | null }): string {
  const forwarded = headerList.get("x-forwarded-for");
  if (forwarded) {
    const [first] = forwarded.split(",");
    const trimmed = first?.trim();
    if (trimmed) {
      return trimmed;
    }
  }

  return headerList.get("x-real-ip")?.trim() || "unknown";
}
