import "server-only";

/**
 * Rate limiting for mutating endpoints.
 *
 * With UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN set (or Vercel KV's
 * KV_REST_API_URL + KV_REST_API_TOKEN), counters live in Redis, so every
 * server instance shares one limit. Without them — local dev, or before Redis
 * is provisioned — it falls back to a per-process window, exactly the
 * previous behaviour. If Redis is unreachable or slow, that single request
 * also falls back to the local window rather than failing the request or
 * skipping the limit.
 */

const KEY_PREFIX = "tagx:rl:";
const REDIS_TIMEOUT_MS = 800;

const buckets = new Map<string, { count: number; resetAt: number }>();

function consumeLocal(key: string, limit: number, windowMs: number): boolean {
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

function redisConfig(): { url: string; token: string } | null {
  const url = (process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL)?.trim();
  const token = (process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN)?.trim();
  return url && token ? { url: url.replace(/\/$/, ""), token } : null;
}

/**
 * Fixed window in Redis: SET NX starts the window with its expiry, INCR
 * counts this request. Both run in one pipeline round trip. Returns null
 * when Redis can't answer, so the caller can fall back.
 */
async function consumeRedis(
  config: { url: string; token: string },
  key: string,
  limit: number,
  windowMs: number,
): Promise<boolean | null> {
  const redisKey = `${KEY_PREFIX}${key}`;
  try {
    const response = await fetch(`${config.url}/pipeline`, {
      method: "POST",
      headers: { authorization: `Bearer ${config.token}`, "content-type": "application/json" },
      body: JSON.stringify([
        ["SET", redisKey, "0", "PX", String(windowMs), "NX"],
        ["INCR", redisKey],
      ]),
      cache: "no-store",
      signal: AbortSignal.timeout(REDIS_TIMEOUT_MS),
    });
    if (!response.ok) {
      return null;
    }
    const results = (await response.json()) as { result?: unknown; error?: string }[];
    const count = results[1]?.result;
    return typeof count === "number" ? count <= limit : null;
  } catch {
    return null;
  }
}

/** True when `key` has used up `limit` requests in the current `windowMs`. */
export async function isRateLimited(key: string, limit: number, windowMs: number): Promise<boolean> {
  const config = redisConfig();
  if (config) {
    const allowed = await consumeRedis(config, key, limit, windowMs);
    if (allowed !== null) {
      return !allowed;
    }
  }
  return !consumeLocal(key, limit, windowMs);
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
