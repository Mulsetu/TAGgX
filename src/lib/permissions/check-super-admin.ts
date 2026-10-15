import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Platform-level check, deliberately independent of company-scoped roles:
 * no company_id, no slug, no tenant context at all. Mirrors
 * public.platform_admins / public.is_super_admin() in the database — see
 * supabase/migrations/0002_platform_admins_and_helpers.sql.
 *
 * Kept in its own file so middleware can import it without pulling in the
 * request-scoped helpers in super-admin.ts (React cache, next/headers).
 */
export async function checkSuperAdmin(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("platform_admins")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  return data !== null;
}
