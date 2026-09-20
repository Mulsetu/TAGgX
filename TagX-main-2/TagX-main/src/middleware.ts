import { NextResponse, type NextRequest } from "next/server";
import {
  applyAuthCookies,
  createMiddlewareClient,
  hasAuthTokenCookie,
  isTransientAuthError,
} from "@/lib/supabase/middleware";
import { checkSuperAdmin } from "@/lib/permissions/super-admin";
import { safePostLoginPath } from "@/lib/paths";
import { resolveTenant, TENANT_HEADERS, tenantLoginPathFromCookie, TENANT_SLUG_COOKIE } from "@/lib/tenant";

interface UserProfileRow {
  company_id: string;
  role_id: string;
}

function continueWithCookies(request: NextRequest, from: NextResponse, headers?: Headers): NextResponse {
  const requestHeaders = headers ?? new Headers(request.headers);
  const cookie = request.cookies
    .getAll()
    .map((entry) => `${entry.name}=${entry.value}`)
    .join("; ");
  if (cookie) {
    requestHeaders.set("cookie", cookie);
  }
  return applyAuthCookies(from, NextResponse.next({ request: { headers: requestHeaders } }));
}

export async function middleware(request: NextRequest) {
  const { supabase, getResponse } = createMiddlewareClient(request);

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  const supabaseResponse = getResponse();
  const { pathname } = request.nextUrl;
  const tenant = resolveTenant(request);
  const isTenantLoginPath = tenant !== null && pathname === `/${tenant.slug}/login`;
  const isTenantPublicPath =
    tenant !== null && (isTenantLoginPath || pathname === `/${tenant.slug}/forgot-password`);
  const isAppShellPath =
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") ||
    pathname === "/assets" ||
    pathname.startsWith("/assets/");
  const isAdminLoginPath = pathname === "/admin/login";
  const isAdminPublicPath = isAdminLoginPath || pathname === "/admin/forgot-password";
  const isAdminPath = pathname === "/admin" || pathname.startsWith("/admin/");
  const isPublicTagPath = pathname === "/tag" || pathname.startsWith("/tag/");

  if (!user) {
    // Keep an existing session if Auth was only unreachable — writing
    // "logged out" cookies here is what made sidebar clicks look like a sign-out.
    if (hasAuthTokenCookie(request) && isTransientAuthError(userError)) {
      return NextResponse.next({ request });
    }

    if (isTenantPublicPath || isAdminPublicPath || isPublicTagPath) {
      return supabaseResponse;
    }

    if (tenant) {
      return applyAuthCookies(
        supabaseResponse,
        NextResponse.redirect(new URL(`/${tenant.slug}/login`, request.url)),
      );
    }

    if (isAppShellPath) {
      const tenantLogin = tenantLoginPathFromCookie(request.cookies.get(TENANT_SLUG_COOKIE)?.value);
      return applyAuthCookies(
        supabaseResponse,
        NextResponse.redirect(new URL(tenantLogin ?? "/", request.url)),
      );
    }

    if (isAdminPath) {
      return applyAuthCookies(
        supabaseResponse,
        NextResponse.redirect(new URL("/admin/login", request.url)),
      );
    }

    return supabaseResponse;
  }

  if (isTenantLoginPath) {
    const nextPath = safePostLoginPath(request.nextUrl.searchParams.get("next") ?? undefined);
    return applyAuthCookies(
      supabaseResponse,
      NextResponse.redirect(new URL(nextPath ?? "/dashboard", request.url)),
    );
  }

  const [{ data: profile }, isSuperAdmin] = await Promise.all([
    supabase
      .from("users")
      .select("company_id, role_id")
      .eq("id", user.id)
      .maybeSingle<UserProfileRow>(),
    checkSuperAdmin(supabase, user.id),
  ]);

  if (isAdminLoginPath) {
    return isSuperAdmin
      ? applyAuthCookies(supabaseResponse, NextResponse.redirect(new URL("/admin", request.url)))
      : continueWithCookies(request, supabaseResponse);
  }

  if (isAdminPath && !isSuperAdmin) {
    return applyAuthCookies(
      supabaseResponse,
      NextResponse.redirect(new URL("/dashboard", request.url)),
    );
  }

  const requestHeaders = new Headers(request.headers);
  if (profile) {
    requestHeaders.set(TENANT_HEADERS.companyId, profile.company_id);
    requestHeaders.set(TENANT_HEADERS.roleId, profile.role_id);
  }
  requestHeaders.set(TENANT_HEADERS.isSuperAdmin, String(isSuperAdmin));

  return continueWithCookies(request, getResponse(), requestHeaders);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
