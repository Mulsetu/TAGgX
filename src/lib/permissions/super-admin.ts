import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { TENANT_HEADERS } from "@/lib/tenant";
import { checkSuperAdmin } from "./check-super-admin";

/**
 * Same check, but for the caller's own session (Server Components/Actions).
 * Middleware already ran checkSuperAdmin for this request and stamped the
 * result on x-is-super-admin (after stripping any client-supplied copy), so
 * that is authoritative when present. The DB lookup is only a fallback for
 * requests middleware did not annotate, and is memoized per request.
 */
export const isCurrentUserSuperAdmin = cache(async (): Promise<boolean> => {
  const fromMiddleware = headers().get(TENANT_HEADERS.isSuperAdmin);
  if (fromMiddleware === "true" || fromMiddleware === "false") {
    return fromMiddleware === "true";
  }

  const user = await getAuthUser();
  if (!user) {
    return false;
  }

  return checkSuperAdmin(createClient(), user.id);
});
