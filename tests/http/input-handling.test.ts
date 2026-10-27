import { describe, expect, it } from "vitest";
import { TARGET_URL, HAS_SERVER, get, isRedirect, location } from "../helpers/http";

// Injection, path traversal, open redirects and information leaks.
const STACK_TRACE = /(at\s+\S+\s+\(.*:\d+:\d+\)|node_modules\/|webpack-internal|ECONNREFUSED|PostgrestError|SUPABASE_SECRET)/;

describe.skipIf(!HAS_SERVER)("input handling", () => {
  it.each([
    "/api/media/..%2f..%2f..%2fetc%2fpasswd",
    "/api/media/companies/../../.env",
    "/api/media/%2e%2e/%2e%2e/package.json",
  ])("media route refuses path traversal: %s", async (path) => {
    const response = await get(path);
    expect(response.status).not.toBe(200);
    expect(await response.text()).not.toMatch(/root:|"dependencies"|SUPABASE/);
  });

  it("media route doesn't serve another company's private files anonymously", async () => {
    const response = await get("/api/media/companies/00000000-0000-4000-8000-000000000000/documents/secret.pdf");
    expect(response.status).toBe(404);
  });

  it.each([
    "/tag/not-a-uuid",
    "/tag/00000000-0000-4000-8000-000000000000",
    "/tag/' OR '1'='1",
    "/tag/%3Cscript%3Ealert(1)%3C%2Fscript%3E",
  ])("public tag page handles hostile ids without a server error: %s", async (path) => {
    const response = await get(path);
    expect(response.status).toBeLessThan(500);
    const body = await response.text();
    expect(body).not.toMatch(STACK_TRACE);
    expect(body).not.toContain("<script>alert(1)</script>");
  });

  it("unknown pages return 404 without leaking internals", async () => {
    const response = await get(`/definitely-not-a-page-${Date.now()}`);
    expect([404, 307, 308]).toContain(response.status);
    expect(await response.text()).not.toMatch(STACK_TRACE);
  });

  it.each(["//evil.example", "/\\evil.example", "https://evil.example"])(
    "login redirects never leave the site (next=%s)",
    async (target) => {
      const response = await get(`/login?next=${encodeURIComponent(target)}`);
      if (isRedirect(response)) {
        expect(location(response)?.origin).toBe(new URL(TARGET_URL).origin);
      }
      expect(await response.text()).not.toMatch(/href=["']https?:\/\/evil\.example/);
    },
  );

  it("reflected query text is escaped", async () => {
    const payload = `<img src=x onerror=alert(1)>`;
    const response = await get(`/login?error=${encodeURIComponent(payload)}&next=${encodeURIComponent(payload)}`);
    expect(await response.text()).not.toContain(payload);
  });

  // ZAP flags ?plan= as user-controllable HTML attribute (rule 10031); prove it can't break out.
  it.each(["/signup", "/signup/continue"])("%s escapes the ?plan= value it echoes into the form", async (path) => {
    const payload = `"><script>alert(1)</script><x y="`;
    const response = await get(`${path}?plan=${encodeURIComponent(payload)}`);
    expect(response.status).toBeLessThan(500);
    const body = await response.text();
    expect(body).not.toContain("<script>alert(1)</script>");
    expect(body).not.toMatch(/value=""><script>/);
  });

  it("oversized query strings are handled without a server error", async () => {
    const response = await get(`/login?q=${"a".repeat(8000)}`);
    expect(response.status).toBeLessThan(500);
  });
});

describe.skipIf(!HAS_SERVER)("robots and discovery files", () => {
  it("robots.txt keeps private areas out of search engines", async () => {
    const body = await (await get("/robots.txt")).text();
    expect(body.toLowerCase()).toMatch(/disallow:\s*\/(dashboard|admin)/);
  });

  it("no source maps or env files are publicly served", async () => {
    for (const path of ["/.env", "/.env.local", "/.git/config", "/next.config.mjs"]) {
      const response = await get(path);
      expect(response.status, path).not.toBe(200);
    }
  });
});
