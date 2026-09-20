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
  company_id: string | null;
  role_id: string | null;
  is_active: boolean;
  is_company_admin: boolean;
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

function isPublicMarketingPath(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname === "/signup" ||
    pathname.startsWith("/signup/") ||
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname === "/demo" ||
    pathname.startsWith("/demo/") ||
    pathname === "/inquire" ||
    pathname.startsWith("/inquire/") ||
    pathname === "/asset-management-system" ||
    pathname.startsWith("/asset-management-system/") ||
    pathname === "/auth" ||
    pathname.startsWith("/auth/") ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname === "/manifest.webmanifest" ||
    pathname.startsWith("/opengraph-image")
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Landing, signup, and SEO files do not need a session. Skipping the
  // Supabase client here keeps crawlers off an auth round-trip.
  if (isPublicMarketingPath(pathname) && !hasAuthTokenCookie(request)) {
    return NextResponse.next();
  }

  const { supabase, getResponse } = createMiddlewareClient(request);

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  const supabaseResponse = getResponse();
  const tenant = resolveTenant(request);
  const isTenantLoginPath = tenant !== null && pathname === `/${tenant.slug}/login`;
  const isTenantPublicPath =
    tenant !== null && (isTenantLoginPath || pathname === `/${tenant.slug}/forgot-password`);
  const isAppShellPath =
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") ||
    pathname === "/assets" ||
    pathname.startsWith("/assets/") ||
    pathname === "/floor" ||
    pathname.startsWith("/floor/");
  const isAdminLoginPath = pathname === "/admin/login";
  const isAdminPublicPath = isAdminLoginPath || pathname === "/admin/forgot-password";
  const isAdminPath = pathname === "/admin" || pathname.startsWith("/admin/");
  const isPublicTagPath = pathname === "/tag" || pathname.startsWith("/tag/");
  const isOnboardingPath = pathname === "/onboarding" || pathname.startsWith("/onboarding/");

  if (!user) {
    // Keep an existing session if Auth was only unreachable — writing
    // "logged out" cookies here is what made sidebar clicks look like a sign-out.
    if (hasAuthTokenCookie(request) && isTransientAuthError(userError)) {
      // Keep the session cookies, but never forward client-supplied tenant
      // headers — those are only authoritative after getUser() succeeds.
      const requestHeaders = new Headers(request.headers);
      requestHeaders.delete(TENANT_HEADERS.companyId);
      requestHeaders.delete(TENANT_HEADERS.roleId);
      requestHeaders.delete(TENANT_HEADERS.isSuperAdmin);
      requestHeaders.delete(TENANT_HEADERS.isCompanyAdmin);
      return NextResponse.next({ request: { headers: requestHeaders } });
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

    if (isAppShellPath || isOnboardingPath) {
      const tenantLogin = tenantLoginPathFromCookie(request.cookies.get(TENANT_SLUG_COOKIE)?.value);
      return applyAuthCookies(
        supabaseResponse,
        NextResponse.redirect(new URL(isOnboardingPath ? "/signup" : (tenantLogin ?? "/"), request.url)),
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

  const [{ data: profileWithAdmin, error: profileError }, isSuperAdmin] = await Promise.all([
    supabase
      .from("users")
      .select("company_id, role_id, is_active, is_company_admin")
      .eq("id", user.id)
      .maybeSingle<UserProfileRow>(),
    checkSuperAdmin(supabase, user.id),
  ]);

  let profile = profileWithAdmin;
  if (profileError && !profile) {
    const fallback = await supabase
      .from("users")
      .select("company_id, role_id, is_active")
      .eq("id", user.id)
      .maybeSingle<{ company_id: string | null; role_id: string | null; is_active: boolean }>();
    profile = fallback.data
      ? { ...fallback.data, is_company_admin: false }
      : null;
  }

  const hasCompany = Boolean(profile?.company_id);
  const emailConfirmed = Boolean(user.email_confirmed_at);
  const isAuthCallbackPath = pathname === "/auth" || pathname.startsWith("/auth/");
  const isCheckEmailPath = pathname === "/signup/check-email" || pathname.startsWith("/signup/check-email");
  const isResetPasswordPath = pathname === "/reset-password" || pathname.startsWith("/reset-password");
  const isInvitePath = pathname === "/invite" || pathname.startsWith("/invite/");

  const tenantProfileInactive = profile?.is_active === false;
  let tenantCompanySuspended = false;
  if (profile?.company_id) {
    const { data: companyRow } = await supabase
      .from("companies")
      .select("suspended_at")
      .eq("id", profile.company_id)
      .maybeSingle<{ suspended_at: string | null }>();
    tenantCompanySuspended = companyRow?.suspended_at != null;
  }

  // Same surfaces that already require a tenant session when logged out:
  // /dashboard, /assets, /floor, and /{slug}/* except login/forgot-password.
  // /tag/** is public and is not included.
  const isProtectedTenantPath = isAppShellPath || (tenant !== null && !isTenantPublicPath);
  const tenantAccessBlocked = tenantProfileInactive || tenantCompanySuspended;

  if (tenantAccessBlocked && isProtectedTenantPath) {
    if (isSuperAdmin) {
      return applyAuthCookies(supabaseResponse, NextResponse.redirect(new URL("/admin", request.url)));
    }

    await supabase.auth.signOut();
    const loginPath =
      tenantLoginPathFromCookie(request.cookies.get(TENANT_SLUG_COOKIE)?.value) ??
      (tenant ? `/${tenant.slug}/login` : "/");
    return applyAuthCookies(getResponse(), NextResponse.redirect(new URL(loginPath, request.url)));
  }

  if (
    !isSuperAdmin &&
    !emailConfirmed &&
    (isAppShellPath || isOnboardingPath || isProtectedTenantPath || (isAdminPath && !isAdminPublicPath)) &&
    !isCheckEmailPath &&
    !isAuthCallbackPath &&
    !isResetPasswordPath &&
    !isInvitePath
  ) {
    return applyAuthCookies(
      supabaseResponse,
      NextResponse.redirect(new URL("/signup/check-email", request.url)),
    );
  }

  if (!isSuperAdmin && emailConfirmed && !hasCompany) {
    if (isAppShellPath || (!isOnboardingPath && tenant !== null && !isTenantPublicPath) || isTenantLoginPath) {
      return applyAuthCookies(supabaseResponse, NextResponse.redirect(new URL("/onboarding", request.url)));
    }
    if (pathname === "/signup") {
      return applyAuthCookies(supabaseResponse, NextResponse.redirect(new URL("/onboarding", request.url)));
    }
  }

  if (hasCompany && (isOnboardingPath || pathname === "/signup" || pathname.startsWith("/signup/"))) {
    return applyAuthCookies(supabaseResponse, NextResponse.redirect(new URL("/dashboard", request.url)));
  }

  if (isOnboardingPath && !hasCompany && !emailConfirmed) {
    return applyAuthCookies(
      supabaseResponse,
      NextResponse.redirect(new URL("/signup/check-email", request.url)),
    );
  }

  if (isTenantLoginPath) {
    if (tenantAccessBlocked) {
      if (isSuperAdmin) {
        return applyAuthCookies(supabaseResponse, NextResponse.redirect(new URL("/admin", request.url)));
      }

      await supabase.auth.signOut();
      return getResponse();
    }

    const nextPath = safePostLoginPath(request.nextUrl.searchParams.get("next") ?? undefined);
    return applyAuthCookies(
      supabaseResponse,
      NextResponse.redirect(new URL(nextPath ?? "/dashboard", request.url)),
    );
  }

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
  if (profile?.company_id) {
    requestHeaders.set(TENANT_HEADERS.companyId, profile.company_id);
  }
  if (profile?.role_id) {
    requestHeaders.set(TENANT_HEADERS.roleId, profile.role_id);
  }
  if (profile) {
    requestHeaders.set(TENANT_HEADERS.isCompanyAdmin, String(profile.is_company_admin === true));
  }
  requestHeaders.set(TENANT_HEADERS.isSuperAdmin, String(isSuperAdmin));

  return continueWithCookies(request, getResponse(), requestHeaders);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
