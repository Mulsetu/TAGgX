import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";

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

/** Prefer a verified user; on a transient Auth outage, fall back to the JWT in cookies so we don't kick them out. */
export async function getRequestAuthUser() {
  const supabase = createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (user) {
    return user;
  }
  if (error) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.user ?? null;
  }
  return null;
}
