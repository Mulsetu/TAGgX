import "server-only";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";

// Publishable-key client with no cookie storage: signing in with it never
// touches the caller's own session cookies. Used to check a password (e.g.
// "current password" on the profile page) without logging anyone in or out.
export function createStatelessClient() {
  return createSupabaseJsClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      global: {
        fetch: (url, options = {}) => fetch(url, { ...options, cache: "no-store" }),
      },
    },
  );
}
