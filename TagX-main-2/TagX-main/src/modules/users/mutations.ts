import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type AcceptInviteResult = { userId: string } | { error: string };

interface AcceptCompanyInviteParams {
  inviteId: string;
  companyId: string;
  roleId: string;
  email: string;
  password: string;
}

/**
 * Completes an invite: creates the auth user (email pre-confirmed — they
 * proved control of the inbox by opening this link) and the matching
 * public.users row, then marks the invite accepted. Service-role client
 * throughout: the invitee has no session at all yet.
 */
export async function acceptCompanyInvite(params: AcceptCompanyInviteParams): Promise<AcceptInviteResult> {
  const supabase = createAdminClient();

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: params.email,
    password: params.password,
    email_confirm: true,
  });

  if (authError || !authData.user) {
    return { error: authError?.message ?? "Could not create your account." };
  }

  const { error: profileError } = await supabase.from("users").insert({
    id: authData.user.id,
    company_id: params.companyId,
    role_id: params.roleId,
    email: params.email,
  });

  if (profileError) {
    // Don't leave an orphaned auth-only account behind if the tenant
    // profile insert fails.
    await supabase.auth.admin.deleteUser(authData.user.id);
    return { error: "Could not finish setting up your account." };
  }

  await supabase
    .from("company_invites")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", params.inviteId);

  return { userId: authData.user.id };
}

export type UserMutationResult = { error: string | null };

/**
 * Deactivating rather than deleting: keeps the row (and its history —
 * asset assignments, maintenance tickets, audit log actor references)
 * intact, just blocks sign-in. RLS's `users_tenant_isolation` scopes this
 * to the caller's own company already.
 */
export async function setUserActive(userId: string, isActive: boolean): Promise<UserMutationResult> {
  const supabase = createClient();

  const { error } = await supabase.from("users").update({ is_active: isActive }).eq("id", userId);

  if (error) {
    return { error: "Could not update this member." };
  }

  return { error: null };
}

export async function updateUserRole(userId: string, roleId: string): Promise<UserMutationResult> {
  const supabase = createClient();

  const { error } = await supabase.from("users").update({ role_id: roleId }).eq("id", userId);

  if (error) {
    return { error: "Could not update this member's role." };
  }

  return { error: null };
}
