import "server-only";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";

// Secret-key client: bypasses RLS entirely. Only for a small, explicit
// set of privileged server-side operations (e.g. reading public tenant
// branding before a session exists, provisioning a user's tenant row).
// Never call this on behalf of a request without first deciding exactly
// which columns/rows it's allowed to touch — RLS won't stop it.
export function createAdminClient() {
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("SUPABASE_SECRET_KEY is not set");
  }

  return createSupabaseJsClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    secretKey,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      // Next.js caches fetch() in Server Components by default. A miss for
      // /{slug}/login (or an empty admin company list) would keep 404ing
      // after the row is created in Supabase — see Vercel "Using cache"
      // on rest/v1/companies.
      global: {
        fetch: (url, options = {}) => fetch(url, { ...options, cache: "no-store" }),
      },
    },
  );
}
