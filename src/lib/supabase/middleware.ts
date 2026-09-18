import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Copy Set-Cookie as raw headers so Path / Max-Age / HttpOnly survive.
 * NextResponse.cookies.getAll() + .set(cookie) drops those attributes,
 * which scopes the session to the current URL and logs the user out on
 * the next sidebar navigation.
 */
export function applyAuthCookies(from: NextResponse, to: NextResponse): NextResponse {
  const setCookies = from.headers.getSetCookie();
  if (setCookies.length > 0) {
    for (const cookie of setCookies) {
      to.headers.append("Set-Cookie", cookie);
    }
    return to;
  }

  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set({ ...cookie, path: cookie.path ?? "/" });
  });
  return to;
}

export function hasAuthTokenCookie(request: NextRequest): boolean {
  return request.cookies.getAll().some((cookie) => cookie.name.includes("-auth-token"));
}

export function isTransientAuthError(error: { name?: string; status?: number; message?: string } | null): boolean {
  if (!error) {
    return false;
  }
  if (error.name === "AuthRetryableFetchError") {
    return true;
  }
  if (error.status && error.status >= 500) {
    return true;
  }
  return (error.message ?? "").toLowerCase().includes("fetch failed");
}

// Middleware can't use next/headers' cookies(); it reads/writes cookies on
// the request/response pair directly. `getResponse()` must be called AFTER
// any Supabase call that might refresh the session (e.g. auth.getUser()),
// since setAll() below replaces the captured response with a fresh one.
export function createMiddlewareClient(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, { ...options, path: options?.path ?? "/" }),
          );
        },
      },
    },
  );

  return { supabase, getResponse: () => response };
}
