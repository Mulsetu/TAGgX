import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Platform-level check, deliberately independent of company-scoped roles:
 * no company_id, no slug, no tenant context at all. Mirrors
 * public.platform_admins / public.is_super_admin() in the database — see
 * supabase/migrations/0002_platform_admins_and_helpers.sql.
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

/** Same check, but for the caller's own session (Server Components/Actions). */
export async function isCurrentUserSuperAdmin(): Promise<boolean> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return false;
  }

  return checkSuperAdmin(supabase, user.id);
}
