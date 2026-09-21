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

/**
 * `x-real-ip` first: on Vercel (and most reverse-proxy setups) it's set by
 * the trusted edge/proxy layer itself to the actual connecting IP, and a
 * client can't override it by sending its own copy — the proxy always
 * replaces it. `x-forwarded-for` is a comma-separated hop chain where the
 * *leftmost* entry is whatever the original client claimed (trivially
 * spoofable — a client can send `X-Forwarded-For: 1.2.3.4` itself to reset
 * every rate-limit bucket keyed on it); the entry the trusted proxy
 * actually appended is the rightmost one, so that's the fallback here, not
 * the first.
 */
export function clientIpFromHeaders(headerList: { get(name: string): string | null }): string {
  const realIp = headerList.get("x-real-ip")?.trim();
  if (realIp) {
    return realIp;
  }

  const forwarded = headerList.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded.split(",").map((part) => part.trim()).filter(Boolean);
    const last = parts.at(-1);
    if (last) {
      return last;
    }
  }

  return "unknown";
}
