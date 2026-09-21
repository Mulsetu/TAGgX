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
  vendorId?: string | null;
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

  const { data: role } = await supabase
    .from("roles")
    .select("is_system, name")
    .eq("id", params.roleId)
    .maybeSingle<{ is_system: boolean; name: string }>();

  const { count: adminCount } = await supabase
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("company_id", params.companyId)
    .eq("is_company_admin", true);

  const isCompanyAdmin =
    (role?.is_system === true && (role.name === "Company Admin" || role.name === "Admin")) ||
    (adminCount ?? 0) === 0;

  const { error: profileError } = await supabase.from("users").insert({
    id: authData.user.id,
    company_id: params.companyId,
    role_id: params.roleId,
    email: params.email,
    vendor_id: params.vendorId ?? null,
    is_company_admin: isCompanyAdmin,
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

export interface CreateCompanyAdminAccountParams {
  companyId: string;
  roleId: string;
  email: string;
  password: string;
  fullName: string | null;
}

/**
 * Self-serve signup: creates the first admin without an invite token.
 * Same service-role path as acceptCompanyInvite — the caller has no
 * session yet, and company_id/role_id must never come from the client.
 */
export async function createCompanyAdminAccount(
  params: CreateCompanyAdminAccountParams,
): Promise<AcceptInviteResult> {
  const supabase = createAdminClient();

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: params.email,
    password: params.password,
    email_confirm: true,
  });

  if (authError || !authData.user) {
    const message = authError?.message ?? "Could not create your account.";
    if (message.toLowerCase().includes("already")) {
      return { error: "An account with this email already exists." };
    }
    return { error: message };
  }

  const { error: profileError } = await supabase.from("users").insert({
    id: authData.user.id,
    company_id: params.companyId,
    role_id: params.roleId,
    email: params.email,
    full_name: params.fullName,
    is_company_admin: true,
  });

  if (profileError) {
    await supabase.auth.admin.deleteUser(authData.user.id);
    if (profileError.code === "23505") {
      return { error: "An account with this email already exists." };
    }
    return { error: "Could not finish setting up your account." };
  }

  return { userId: authData.user.id };
}

export type UserMutationResult = { error: string | null };

export async function insertOnboardingUser(input: {
  userId: string;
  email: string;
  fullName: string | null;
}): Promise<AcceptInviteResult> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("users").insert({
    id: input.userId,
    company_id: null,
    role_id: null,
    email: input.email,
    full_name: input.fullName,
    is_company_admin: false,
  });
  if (error) {
    if (error.code === "23505") {
      return { error: "An account with this email already exists. Please sign in or reset your password." };
    }
    return { error: "Could not finish setting up your account." };
  }
  return { userId: input.userId };
}

export async function attachUserToCompany(input: {
  userId: string;
  companyId: string;
  roleId: string;
  isCompanyAdmin: boolean;
}): Promise<UserMutationResult> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("users")
    .update({
      company_id: input.companyId,
      role_id: input.roleId,
      is_company_admin: input.isCompanyAdmin,
    })
    .eq("id", input.userId);
  if (error) {
    return { error: "Could not attach this account to the workspace." };
  }
  return { error: null };
}

/**
 * Undoes attachUserToCompany. `users.company_id` is `on delete cascade`
 * against `companies` (see 0006_users.sql), so deleting a company while
 * the caller's own `public.users` row still points at it — e.g. a later
 * onboarding step failing after attachUserToCompany already ran — would
 * take the account down with it: no company, no profile row,
 * getCurrentUser() starts returning null, and there's no signup path back
 * in since the auth.users email already exists. Call this before
 * deleteCompany() in any onboarding rollback so the account survives and
 * the user lands back on /onboarding to try again.
 */
export async function detachUserFromCompany(userId: string): Promise<UserMutationResult> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("users")
    .update({ company_id: null, role_id: null, is_company_admin: false })
    .eq("id", userId);
  if (error) {
    return { error: "Could not roll back the workspace attempt." };
  }
  return { error: null };
}

/**
 * Deactivating rather than deleting: keeps the row (and its history —
 * asset assignments, maintenance tickets, audit log actor references)
 * intact, just blocks sign-in. Runs through the set_user_active() RPC
 * (migration 0048) rather than a direct table update — it re-checks
 * users.edit permission and tenant scope at the database layer, since
 * RLS on `users` no longer grants authenticated a column-level UPDATE.
 */
export async function setUserActive(userId: string, isActive: boolean): Promise<UserMutationResult> {
  const supabase = createClient();

  const { error } = await supabase.rpc("set_user_active", { p_user_id: userId, p_is_active: isActive });

  if (error) {
    return { error: "Could not update this member." };
  }

  return { error: null };
}

export async function updateUserRole(userId: string, roleId: string): Promise<UserMutationResult> {
  const supabase = createClient();

  const { error } = await supabase.rpc("update_user_role", { p_user_id: userId, p_role_id: roleId });

  if (error) {
    return { error: "Could not update this member's role." };
  }

  return { error: null };
}

export async function setUserCompanyAdmin(userId: string, isCompanyAdmin: boolean): Promise<UserMutationResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc("set_company_admin", {
    p_user_id: userId,
    p_is_company_admin: isCompanyAdmin,
  });
  if (error) {
    return { error: "Could not update company admin access." };
  }
  return { error: null };
}

export async function countCompanyAdmins(): Promise<number> {
  const supabase = createClient();
  const { count } = await supabase
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("is_company_admin", true)
    .eq("is_active", true);
  return count ?? 0;
}
