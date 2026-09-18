"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { safePostLoginPath } from "@/lib/paths";
import { TENANT_SLUG_COOKIE, tenantLoginPathFromCookie } from "@/lib/tenant";
import { clientIpFromHeaders, consumeRateLimit } from "@/lib/rate-limit";
import { getCompanyBySlug, getCompanySuspendedAt } from "@/modules/companies/queries";
import { createCompanyInvite } from "@/modules/companies/mutations";
import { getCurrentCompany } from "@/modules/companies/actions";
import { checkSuperAdmin, isCurrentUserSuperAdmin } from "@/lib/permissions/super-admin";
import { requirePermission } from "@/lib/permissions/has-permission";
import { TENANT_READ_ONLY_MESSAGE, requireWritableTenant } from "@/lib/permissions/tenant-access";
import { sendUserInviteEmail } from "@/lib/email";
import {
  forgotPasswordSchema,
  inviteUserSchema,
  resetPasswordSchema,
  signInSchema,
} from "./validation";
import { getInviteByToken, getUserWithRole, listCompanyUsers, listPendingInvites } from "./queries";
import { acceptCompanyInvite, setUserActive, updateUserRole } from "./mutations";
import type {
  AcceptInviteState,
  CompanyUserSummary,
  CurrentUser,
  ForgotPasswordState,
  InviteDetails,
  InviteUserFormState,
  PendingInviteSummary,
  ResetPasswordState,
  SignInState,
  UserActionState,
} from "./types";

/** For /invite/[token] — the page calls this, never queries.ts directly. */
export async function getInviteForAcceptPage(token: string): Promise<InviteDetails | null> {
  return getInviteByToken(token);
}

/**
 * Signs a user into a specific company's tenant login page. `slug` comes
 * from the page via Function.bind (see login-form.tsx), not from
 * `formData` — either way it's never trusted on its own: after Supabase
 * Auth accepts the credentials, the authenticated user's own
 * `public.users.company_id` is checked against the resolved company's id.
 * A valid password for the wrong tenant's login page is rejected, not just
 * a valid-looking slug.
 */
export async function signIn(
  slug: string,
  nextPath: string | null,
  _prevState: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: "Enter a valid email and password." };
  }

  // In-process only (single instance). Multi-instance needs Redis — TAGX-019.
  // Successful logins still consume a slot; the window does not reset on success.
  const loginKey = `login:${clientIpFromHeaders(headers())}:${parsed.data.email.toLowerCase()}:${slug}`;
  if (!consumeRateLimit(loginKey, 10, 15 * 60 * 1000)) {
    return { error: "Try again later." };
  }

  const company = await getCompanyBySlug(slug);
  if (!company) {
    return { error: "This company could not be found." };
  }

  const supabase = createClient();

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword(
    parsed.data,
  );

  if (authError || !authData.user) {
    return { error: "Invalid email or password." };
  }

  const { data: profile } = await supabase
    .from("users")
    .select("company_id, is_active")
    .eq("id", authData.user.id)
    .maybeSingle<{ company_id: string; is_active: boolean }>();

  if (!profile || profile.company_id !== company.id) {
    await supabase.auth.signOut();
    return { error: "No account was found for this company." };
  }

  if (!profile.is_active) {
    await supabase.auth.signOut();
    return { error: "Invalid email or password." };
  }

  if (await getCompanySuspendedAt(company.id)) {
    await supabase.auth.signOut();
    return { error: "This workspace is unavailable." };
  }

  cookies().set(TENANT_SLUG_COOKIE, slug, {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 400,
  });

  return { error: null, redirectPath: safePostLoginPath(nextPath ?? undefined) ?? "/dashboard" };
}

/**
 * Signs in to the platform-level /admin section. Deliberately separate
 * from `signIn`: there's no company/slug to scope this to, and the check
 * afterward is against `platform_admins`, not `public.users.company_id` —
 * a valid password for a regular tenant account must not grant access here.
 */
export async function signInSuperAdmin(
  _prevState: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: "Enter a valid email and password." };
  }

  const adminLoginKey = `admin-login:${clientIpFromHeaders(headers())}:${parsed.data.email.toLowerCase()}`;
  if (!consumeRateLimit(adminLoginKey, 10, 15 * 60 * 1000)) {
    return { error: "Try again later." };
  }

  const supabase = createClient();

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword(
    parsed.data,
  );

  if (authError || !authData.user) {
    return { error: "Invalid email or password." };
  }

  if (!(await checkSuperAdmin(supabase, authData.user.id))) {
    await supabase.auth.signOut();
    return { error: "This account is not a platform administrator." };
  }

  return { error: null, redirectPath: "/admin" };
}

/** The signed-in caller's own profile, for rendering the top bar/user menu. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  return getUserWithRole(user.id);
}

/** Session-derived vendor scope. Never accept a client-supplied company or vendor id. */
export async function getVendorScope(): Promise<string | null> {
  const user = await getCurrentUser();
  return user?.vendorId ?? null;
}

export async function signOutAction(from: "admin" | "tenant"): Promise<{ redirectPath: string }> {
  const company = from === "tenant" ? await getCurrentCompany() : null;
  const cookieLogin = tenantLoginPathFromCookie(cookies().get(TENANT_SLUG_COOKIE)?.value);

  let redirectPath = "/";
  if (from === "admin") {
    redirectPath = "/admin/login";
  } else if (company?.slug) {
    redirectPath = `/${company.slug}/login`;
  } else if (cookieLogin) {
    redirectPath = cookieLogin;
  } else if (await isCurrentUserSuperAdmin()) {
    redirectPath = "/admin/login";
  }

  const supabase = createClient();
  await supabase.auth.signOut();
  return { redirectPath };
}

/**
 * Requests a Supabase Auth password-reset email (Supabase's own email
 * system — separate from the Brevo integration in lib/email.ts). Always
 * reports success regardless of whether the address is registered, so
 * this can't be used to enumerate accounts. `afterLoginPath` is baked
 * into the redirect URL so /reset-password knows which login page to
 * send the user back to once they're done.
 */
export async function requestPasswordResetAction(
  afterLoginPath: string,
  _prevState: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const parsed = forgotPasswordSchema.safeParse({ email: formData.get("email") });

  if (!parsed.success) {
    return { submitted: false, error: "Enter a valid email address." };
  }

  const resetKey = `reset:${clientIpFromHeaders(headers())}:${parsed.data.email.toLowerCase()}`;
  if (!consumeRateLimit(resetKey, 5, 15 * 60 * 1000)) {
    return { submitted: false, error: "Too many reset emails. Try again later." };
  }

  const supabase = createClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const redirectTo = `${appUrl}/reset-password?redirect=${encodeURIComponent(afterLoginPath)}`;

  await supabase.auth.resetPasswordForEmail(parsed.data.email, { redirectTo });

  return { submitted: true, error: null };
}

/**
 * Completes a password reset. The recovery access/refresh tokens live in
 * the emailed link's URL *fragment*, which the server never sees — the
 * client-side reset-password-form.tsx reads it from
 * `window.location.hash` and passes both tokens in here, where
 * setSession() establishes the recovery session server-side before
 * updateUser() changes the password. Keeps every Supabase call inside
 * modules/*, none in the component itself.
 */
export async function updatePasswordAction(
  accessToken: string,
  refreshToken: string,
  _prevState: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const parsed = resetPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = createClient();

  const { error: sessionError } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (sessionError) {
    return { success: false, error: "This reset link is invalid or has expired." };
  }

  const { error: updateError } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (updateError) {
    return { success: false, error: "Could not update your password." };
  }

  await supabase.auth.signOut();

  return { success: true, error: null };
}

/**
 * Completes a company-setup invite: validates the token server-side
 * again (never trusts that the page's own earlier check is still true),
 * creates the account, then sends them to their company's login page —
 * matching the flow: set password -> redirected to login -> sign in ->
 * dashboard. Not auto-signed-in on purpose.
 */
export async function acceptInviteAction(
  token: string,
  _prevState: AcceptInviteState,
  formData: FormData,
): Promise<AcceptInviteState> {
  const invite = await getInviteByToken(token);

  if (!invite) {
    return { error: "This invite link is invalid." };
  }
  if (invite.isAccepted) {
    return { error: "This invite has already been used." };
  }
  if (invite.isExpired) {
    return { error: "This invite link has expired." };
  }

  const parsed = resetPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const result = await acceptCompanyInvite({
    inviteId: invite.id,
    companyId: invite.companyId,
    roleId: invite.roleId,
    email: invite.email,
    password: parsed.data.password,
    vendorId: invite.vendorId,
  });

  if ("error" in result) {
    return { error: result.error };
  }

  // Clear whatever session this browser happens to be carrying (a stale
  // recovery session, or — e.g. a super admin testing their own invite
  // link — an unrelated account entirely) before sending them to login.
  // Otherwise middleware sees an existing session on the tenant login
  // path and bounces straight to /dashboard instead of showing the form,
  // silently skipping the "sign in with your new password" step.
  await createClient().auth.signOut();

  // Client navigates on success rather than redirect() here — same
  // pattern as updatePasswordAction/reset-password-form.tsx.
  return { error: null, redirectPath: `/${invite.companySlug}/login` };
}

/** For the Administration Users page. */
export async function getCompanyUsersForAdmin(): Promise<CompanyUserSummary[]> {
  if (!(await requirePermission("users", "view"))) {
    return [];
  }
  return listCompanyUsers();
}

/** For the Administration Users page. */
export async function getPendingInvitesForAdmin(): Promise<PendingInviteSummary[]> {
  if (!(await requirePermission("users", "view"))) {
    return [];
  }
  return listPendingInvites();
}

/**
 * Invites a new member to the caller's own company — the same
 * token-based "set your password" flow super admins use when creating a
 * company, just company-scoped instead of platform-scoped. Sends the real
 * email in production, or hands the link back directly in dev (see
 * lib/email.ts's shouldSendReal()) so testing never depends on Brevo.
 */
export async function inviteCompanyUserAction(
  _prevState: InviteUserFormState,
  formData: FormData,
): Promise<InviteUserFormState> {
  if (!(await requireWritableTenant())) {
    return { error: TENANT_READ_ONLY_MESSAGE };
  }
  if (!(await requirePermission("users", "create"))) {
    return { error: "You don't have permission to invite users." };
  }

  const parsed = inviteUserSchema.safeParse({
    email: formData.get("email"),
    roleId: formData.get("roleId"),
    vendorId: formData.get("vendorId"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const company = await getCurrentCompany();
  if (!company) {
    return { error: "Could not determine your company." };
  }

  const inviteKey = `invite:${company.id}:${clientIpFromHeaders(headers())}`;
  if (!consumeRateLimit(inviteKey, 10, 60 * 60 * 1000)) {
    return { error: "Too many invites. Try again later." };
  }

  const supabase = createClient();

  // Confirms the chosen role actually belongs to this company — RLS's
  // roles_tenant_isolation policy means this returns null for any other
  // company's role id, tampered with client-side or not.
  const { data: role } = await supabase.from("roles").select("id").eq("id", parsed.data.roleId).maybeSingle();
  if (!role) {
    return { error: "Role not found." };
  }

  const {
    data: { user: invitedBy },
  } = await supabase.auth.getUser();

  const inviteResult = await createCompanyInvite(
    company.id,
    parsed.data.roleId,
    parsed.data.email,
    invitedBy?.id ?? null,
    parsed.data.vendorId,
  );
  if ("error" in inviteResult) {
    return { error: inviteResult.error };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const inviteUrl = `${appUrl}/invite/${inviteResult.token}`;

  const emailResult = await sendUserInviteEmail({
    to: parsed.data.email,
    companyName: company.name,
    inviteUrl,
  });

  revalidatePath("/dashboard/administration/users");

  const isProd = process.env.NODE_ENV === "production";
  const showLinkDirectly = !isProd || "error" in emailResult;

  return { error: null, inviteUrl: showLinkDirectly ? inviteUrl : undefined };
}

export async function updateUserRoleAction(userId: string, roleId: string): Promise<UserActionState> {
  if (!(await requireWritableTenant())) {
    return { error: TENANT_READ_ONLY_MESSAGE };
  }
  if (!(await requirePermission("users", "edit"))) {
    return { error: "You don't have permission to edit users." };
  }

  const supabase = createClient();
  const { data: role } = await supabase.from("roles").select("id").eq("id", roleId).maybeSingle();
  if (!role) {
    return { error: "Role not found." };
  }

  const result = await updateUserRole(userId, roleId);
  revalidatePath("/dashboard/administration/users");
  return result;
}

export async function toggleUserActiveAction(userId: string, isActive: boolean): Promise<UserActionState> {
  if (!(await requireWritableTenant())) {
    return { error: TENANT_READ_ONLY_MESSAGE };
  }
  if (!(await requirePermission("users", "edit"))) {
    return { error: "You don't have permission to edit users." };
  }

  const supabase = createClient();
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();

  if (!isActive && currentUser?.id === userId) {
    return { error: "You can't deactivate your own account." };
  }

  const result = await setUserActive(userId, isActive);
  revalidatePath("/dashboard/administration/users");
  return result;
}
