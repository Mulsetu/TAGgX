import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clientIpFromHeaders, consumeRateLimit } from "./rate-limit";

function headersFrom(entries: Record<string, string>) {
  return { get: (name: string) => entries[name.toLowerCase()] ?? null };
}

describe("consumeRateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows requests up to the limit, then blocks", () => {
    const key = `test:${Math.random()}`;
    expect(consumeRateLimit(key, 3, 1000)).toBe(true);
    expect(consumeRateLimit(key, 3, 1000)).toBe(true);
    expect(consumeRateLimit(key, 3, 1000)).toBe(true);
    expect(consumeRateLimit(key, 3, 1000)).toBe(false);
  });

  it("resets after the window elapses", () => {
    const key = `test:${Math.random()}`;
    expect(consumeRateLimit(key, 1, 1000)).toBe(true);
    expect(consumeRateLimit(key, 1, 1000)).toBe(false);

    vi.setSystemTime(1001);
    expect(consumeRateLimit(key, 1, 1000)).toBe(true);
  });

  it("keeps separate buckets per key", () => {
    const keyA = `test-a:${Math.random()}`;
    const keyB = `test-b:${Math.random()}`;
    expect(consumeRateLimit(keyA, 1, 1000)).toBe(true);
    expect(consumeRateLimit(keyA, 1, 1000)).toBe(false);
    // A different key's bucket is untouched by A being exhausted.
    expect(consumeRateLimit(keyB, 1, 1000)).toBe(true);
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
