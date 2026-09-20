import type { NextRequest } from "next/server";

// Kept in sync by hand with supabase/migrations/0004_reserved_slugs.sql.
// The database is the source of truth (it's what actually stops a company
// from being created with one of these slugs); this copy just lets
// middleware reject an obviously-reserved path without a DB round trip.
const RESERVED_SLUGS = new Set([
  "admin",
  "api",
  "app",
  "www",
  "login",
  "dashboard",
  "assets",
  "static",
  "reset-password",
  "invite",
  "tag",
]);

// The two alternatives can't match the same characters (one requires a
// leading "-"), so backtracking here is linear in length, not exponential —
// verified from the pattern's structure, not just the length guard below.
// eslint-disable-next-line security/detect-unsafe-regex
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// Header names middleware.ts uses to forward the resolved request context
// to Server Components / Route Handlers / Server Actions.
export const TENANT_SLUG_COOKIE = "tagx-tenant-slug";

export function isValidTenantSlug(value: string): boolean {
  return value.length > 0 && value.length <= 63 && SLUG_PATTERN.test(value) && !RESERVED_SLUGS.has(value);
}

/** Last company login, so an expired dashboard session can return to /{slug}/login. */
export function tenantLoginPathFromCookie(value: string | undefined): string | null {
  if (!value || !isValidTenantSlug(value)) {
    return null;
  }
  return `/${value}/login`;
}

export const TENANT_HEADERS = {
  companyId: "x-company-id",
  roleId: "x-role-id",
  isSuperAdmin: "x-is-super-admin",
} as const;

export interface ResolvedTenant {
  slug: string;
}

/**
 * Figures out which company a request belongs to, based only on the
 * request itself (no DB lookup, no session) — safe to call on every
 * request from middleware.
 *
 * Today (a): the slug is the first URL path segment, e.g. `/acme/login`.
 * Later (b), subdomain-based tenancy can be added as an earlier branch
 * that inspects the Host header and returns before the path-based check
 * ever runs — every caller of resolveTenant() keeps working unchanged
 * since the return shape doesn't change.
 */
export function resolveTenant(request: NextRequest): ResolvedTenant | null {
  // Future: subdomain-based tenancy.
  //
  //   const host = request.headers.get("host") ?? "";
  //   const subdomain = getSubdomainFromHost(host);
  //   if (subdomain) return { slug: subdomain };

  const [, firstSegment = ""] = request.nextUrl.pathname.split("/");

  if (!firstSegment || firstSegment.length > 63 || RESERVED_SLUGS.has(firstSegment)) {
    return null;
  }

  if (!SLUG_PATTERN.test(firstSegment)) {
    return null;
  }

  return { slug: firstSegment };
}
