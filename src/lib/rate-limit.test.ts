import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clientIpFromHeaders, isRateLimited } from "./rate-limit";

function headersFrom(entries: Record<string, string>) {
  return { get: (name: string) => entries[name.toLowerCase()] ?? null };
}

describe("isRateLimited (local fallback, no Redis configured)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows requests up to the limit, then blocks", async () => {
    const key = `test:${Math.random()}`;
    expect(await isRateLimited(key, 3, 1000)).toBe(false);
    expect(await isRateLimited(key, 3, 1000)).toBe(false);
    expect(await isRateLimited(key, 3, 1000)).toBe(false);
    expect(await isRateLimited(key, 3, 1000)).toBe(true);
  });

  it("resets after the window elapses", async () => {
    const key = `test:${Math.random()}`;
    expect(await isRateLimited(key, 1, 1000)).toBe(false);
    expect(await isRateLimited(key, 1, 1000)).toBe(true);

    vi.setSystemTime(1001);
    expect(await isRateLimited(key, 1, 1000)).toBe(false);
  });

  it("keeps separate buckets per key", async () => {
    const keyA = `test-a:${Math.random()}`;
    const keyB = `test-b:${Math.random()}`;
    expect(await isRateLimited(keyA, 1, 1000)).toBe(false);
    expect(await isRateLimited(keyA, 1, 1000)).toBe(true);
    // A different key's bucket is untouched by A being exhausted.
    expect(await isRateLimited(keyB, 1, 1000)).toBe(false);
  });
});

describe("isRateLimited (Redis configured)", () => {
  beforeEach(() => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example.test/");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-token");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  function stubRedisCount(count: number) {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([{ result: "OK" }, { result: count }]), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("uses the shared Redis counter and sends one pipelined SET NX + INCR", async () => {
    const fetchMock = stubRedisCount(2);
    expect(await isRateLimited("login:1.2.3.4", 3, 60_000)).toBe(false);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://redis.example.test/pipeline");
    expect(init.headers).toMatchObject({ authorization: "Bearer test-token" });
    expect(JSON.parse(String(init.body))).toEqual([
      ["SET", "tagx:rl:login:1.2.3.4", "0", "PX", "60000", "NX"],
      ["INCR", "tagx:rl:login:1.2.3.4"],
    ]);
  });

  it("blocks once the shared count passes the limit", async () => {
    stubRedisCount(4);
    expect(await isRateLimited("login:1.2.3.4", 3, 60_000)).toBe(true);
  });

  it("falls back to the local window when Redis errors, instead of skipping the limit", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    const key = `redis-down:${Math.random()}`;
    expect(await isRateLimited(key, 1, 60_000)).toBe(false);
    expect(await isRateLimited(key, 1, 60_000)).toBe(true);
  });

  it("falls back to the local window on a non-200 response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("unauthorized", { status: 401 })));
    const key = `redis-401:${Math.random()}`;
    expect(await isRateLimited(key, 1, 60_000)).toBe(false);
    expect(await isRateLimited(key, 1, 60_000)).toBe(true);
  });
});

describe("clientIpFromHeaders", () => {
  it("prefers x-real-ip over x-forwarded-for", () => {
    const headers = headersFrom({ "x-real-ip": "203.0.113.9", "x-forwarded-for": "198.51.100.1" });
    expect(clientIpFromHeaders(headers)).toBe("203.0.113.9");
  });

  it("falls back to the last (trusted-proxy-appended) x-forwarded-for entry, not the first", () => {
    // The leftmost entry is whatever the client itself claimed and is
    // trivially spoofable; the rightmost is what the trusted proxy
    // actually appended. Regression test for the fix that swapped this.
    const headers = headersFrom({ "x-forwarded-for": "1.2.3.4, 203.0.113.9" });
    expect(clientIpFromHeaders(headers)).toBe("203.0.113.9");
  });

  it("handles a single x-forwarded-for entry", () => {
    const headers = headersFrom({ "x-forwarded-for": "203.0.113.9" });
    expect(clientIpFromHeaders(headers)).toBe("203.0.113.9");
  });

  it("returns 'unknown' when neither header is present", () => {
    expect(clientIpFromHeaders(headersFrom({}))).toBe("unknown");
  });

  it("ignores blank segments in a malformed x-forwarded-for", () => {
    const headers = headersFrom({ "x-forwarded-for": "1.2.3.4, , 203.0.113.9," });
    expect(clientIpFromHeaders(headers)).toBe("203.0.113.9");
  });
});
