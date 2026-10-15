import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { isTransientAuthError } from "./middleware";

// For Server Components, Server Actions, and Route Handlers. Runs with the
// caller's session (publishable key + auth cookies), so it is subject to RLS.
export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, { ...options, path: options?.path ?? "/" }),
            );
          } catch {
            // Called from a Server Component render, which can't set
            // cookies. Safe to ignore as long as middleware.ts is also
            // refreshing the session on every request.
          }
        },
      },
      // Avoid stale empty lists (e.g. /admin Companies) after SQL inserts.
      global: {
        fetch: (url, options = {}) => fetch(url, { ...options, cache: "no-store" }),
      },
    },
  );
}

/**
 * The verified Auth user for this request. getUser() is a network round
 * trip to Supabase Auth, so it is memoized per request: the shell, sidebar,
 * permission guards and page all share one call instead of each making
 * their own.
 */
const getVerifiedAuth = cache(async () => {
  const {
    data: { user },
    error,
  } = await createClient().auth.getUser();
  return { user, error };
});

/** Verified user or null — the cached equivalent of `supabase.auth.getUser()`. */
export async function getAuthUser() {
  return (await getVerifiedAuth()).user;
}

/**
 * Prefer a verified user; on a *transient* Auth outage only, fall back to
 * the unverified JWT in cookies so we don't kick them out mid-outage.
 * getSession() doesn't round-trip to the auth server, so treating every
 * getUser() error (an expired/invalid token included) as "outage, fall
 * back" would accept a stale or tampered session — isTransientAuthError
 * narrows that to actual 5xx/network-failure cases, same check
 * middleware.ts uses for the same tradeoff.
 */
export async function getRequestAuthUser() {
  const { user, error } = await getVerifiedAuth();
  if (user) {
    return user;
  }
  if (error && isTransientAuthError(error)) {
    const {
      data: { session },
    } = await createClient().auth.getSession();
    return session?.user ?? null;
  }
  return null;
}
