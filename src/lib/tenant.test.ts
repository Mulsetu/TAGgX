import { describe, expect, it } from "vitest";
import type { NextRequest } from "next/server";
import { isValidTenantSlug, resolveTenant, tenantLoginPathFromCookie } from "./tenant";

function requestFor(pathname: string): NextRequest {
  // resolveTenant only ever reads request.nextUrl.pathname — a fake
  // object shaped like that is enough, and (being a type-only import)
  // doesn't pull in next/server's real NextRequest at runtime.
  return { nextUrl: { pathname } } as unknown as NextRequest;
}

describe("isValidTenantSlug", () => {
  it("accepts simple lowercase slugs", () => {
    expect(isValidTenantSlug("acme")).toBe(true);
    expect(isValidTenantSlug("acme-corp")).toBe(true);
    expect(isValidTenantSlug("a1b2")).toBe(true);
  });

  it("rejects reserved slugs — these must never resolve to a tenant", () => {
    // A regression here would mean e.g. /admin/anything or /api/anything
    // gets misread as a company slug instead of a platform route.
    for (const reserved of ["admin", "api", "dashboard", "assets", "login", "signup", "onboarding", "tag", "floor"]) {
      expect(isValidTenantSlug(reserved)).toBe(false);
    }
  });

  it("rejects empty, oversized, and malformed slugs", () => {
    expect(isValidTenantSlug("")).toBe(false);
    expect(isValidTenantSlug("a".repeat(64))).toBe(false);
    expect(isValidTenantSlug("Acme")).toBe(false); // uppercase not allowed
    expect(isValidTenantSlug("-acme")).toBe(false); // leading hyphen
    expect(isValidTenantSlug("acme-")).toBe(false); // trailing hyphen
    expect(isValidTenantSlug("acme_corp")).toBe(false); // underscore not allowed
    expect(isValidTenantSlug("acme--corp")).toBe(false); // double hyphen
  });
});

describe("resolveTenant", () => {
  it("resolves a valid first path segment to a tenant", () => {
    expect(resolveTenant(requestFor("/acme/login"))).toEqual({ slug: "acme" });
    expect(resolveTenant(requestFor("/acme"))).toEqual({ slug: "acme" });
  });

  it("returns null for reserved first segments — these must stay platform routes", () => {
    // The whole point of the reserved-slug list: /admin/x must never be
    // read as "tenant 'admin', path /x" by anything downstream.
    for (const path of ["/admin/login", "/api/media/x", "/dashboard", "/assets/new", "/tag/123"]) {
      expect(resolveTenant(requestFor(path))).toBeNull();
    }
  });

  it("returns null for the root path", () => {
    expect(resolveTenant(requestFor("/"))).toBeNull();
  });

  it("returns null for a malformed slug segment", () => {
    expect(resolveTenant(requestFor("/Acme/login"))).toBeNull();
    expect(resolveTenant(requestFor("/-acme/login"))).toBeNull();
  });
});

describe("tenantLoginPathFromCookie", () => {
  it("builds a login path from a valid slug", () => {
    expect(tenantLoginPathFromCookie("acme")).toBe("/acme/login");
  });

  it("returns null for an undefined, empty, or reserved cookie value", () => {
    expect(tenantLoginPathFromCookie(undefined)).toBeNull();
    expect(tenantLoginPathFromCookie("")).toBeNull();
    expect(tenantLoginPathFromCookie("admin")).toBeNull();
  });
});
