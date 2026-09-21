import "server-only";
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
    },
  );
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
  const supabase = createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (user) {
    return user;
  }
  if (error && isTransientAuthError(error)) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.user ?? null;
  }
  return null;
}
