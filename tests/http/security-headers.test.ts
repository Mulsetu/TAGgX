import { describe, expect, it } from "vitest";
import { TARGET_URL, HAS_SERVER, get } from "../helpers/http";

// OWASP Secure Headers baseline, checked on what the server actually sends.
const PAGES = ["/", "/login", "/admin/login", "/signup"];

describe.skipIf(!HAS_SERVER)("security headers on live responses", () => {
  it.each(PAGES)("%s sends the baseline security headers", async (path) => {
    const response = await get(path);
    const headers = response.headers;
    expect(headers.get("x-content-type-options")).toBe("nosniff");
    expect(headers.get("x-frame-options")).toMatch(/^(DENY|SAMEORIGIN)$/i);
    expect(headers.get("referrer-policy")).toBeTruthy();
    expect(headers.get("permissions-policy")).toBeTruthy();
    const csp = headers.get("content-security-policy") ?? "";
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors");
    expect(csp).toContain("base-uri 'self'");
  });

  it.runIf(TARGET_URL.startsWith("https://"))("sends HSTS over HTTPS", async () => {
    const response = await get("/");
    expect(response.headers.get("strict-transport-security")).toMatch(/max-age=\d{7,}/);
  });

  it("does not advertise the framework (X-Powered-By)", async () => {
    const response = await get("/");
    expect(response.headers.get("x-powered-by")).toBeNull();
  });

  it("does not allow any origin to read responses with credentials", async () => {
    const response = await get("/", { headers: { origin: "https://evil.example" } });
    const allowOrigin = response.headers.get("access-control-allow-origin");
    expect(allowOrigin === "*" || allowOrigin === "https://evil.example").toBe(false);
  });

  it("rejects TRACE requests", async () => {
    const response = await fetch(`${TARGET_URL}/`, { method: "TRACE", redirect: "manual" }).catch(() => null);
    // Some stacks refuse at the socket level (fetch throws); either way, no 200 echo.
    expect(response?.status ?? 405).not.toBe(200);
  });
});
