import { describe, expect, it } from "vitest";
import { TARGET_URL, HAS_SERVER, get, isRedirect, location } from "../helpers/http";

// Broken access control is OWASP Top 10 #1. Every private route must turn
// an anonymous visitor away, and must not trust tenant headers the client sends.
const PRIVATE_PAGES = [
  "/dashboard",
  "/dashboard/profile",
  "/dashboard/administration/settings/workspace",
  "/dashboard/administration/settings/billing",
  "/dashboard/administration/users",
  "/dashboard/administration/maintenance",
  "/assets",
  "/assets/new",
  "/floor",
];
const ADMIN_PAGES = ["/admin", "/admin/profile"];
const RANDOM_ID = "00000000-0000-4000-8000-000000000000";

describe.skipIf(!HAS_SERVER)("access control for anonymous visitors", () => {
  it.each(PRIVATE_PAGES)("%s redirects away instead of rendering", async (path) => {
    const response = await get(path);
    expect(isRedirect(response)).toBe(true);
    // Never bounce to another site.
    expect(location(response)?.origin).toBe(new URL(TARGET_URL).origin);
  });

  it.each(ADMIN_PAGES)("%s redirects to the admin login", async (path) => {
    const response = await get(path);
    expect(isRedirect(response)).toBe(true);
    expect(location(response)?.pathname).toBe("/admin/login");
  });

  it("an invoice PDF can't be downloaded without a session", async () => {
    const response = await get(`/dashboard/administration/invoices/${RANDOM_ID}/pdf`);
    expect(response.status).not.toBe(200);
    expect(response.headers.get("content-type") ?? "").not.toContain("application/pdf");
  });

  it("spoofed tenant/role headers don't grant access", async () => {
    const response = await get("/dashboard", {
      headers: {
        "x-company-id": RANDOM_ID,
        "x-role-id": RANDOM_ID,
        "x-is-super-admin": "true",
        "x-is-company-admin": "true",
      },
    });
    expect(isRedirect(response)).toBe(true);
  });

  it("a forged auth cookie doesn't grant access", async () => {
    const response = await get("/dashboard", {
      headers: { cookie: "sb-access-token=forged; sb-placeholder-auth-token=base64-eyJmb3JnZWQiOnRydWV9" },
    });
    expect(isRedirect(response)).toBe(true);
  });
});

describe.skipIf(!HAS_SERVER)("cron endpoint", () => {
  it("rejects requests without the cron secret", async () => {
    expect((await get("/api/cron/notifications")).status).toBe(401);
  });

  it("rejects a wrong cron secret", async () => {
    const response = await get("/api/cron/notifications", { headers: { authorization: "Bearer wrong-secret" } });
    expect(response.status).toBe(401);
  });
});
