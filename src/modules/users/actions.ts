"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safePostLoginPath } from "@/lib/paths";
import { isValidTenantSlug, TENANT_SLUG_COOKIE, tenantLoginPathFromCookie } from "@/lib/tenant";
import { clientIpFromHeaders, consumeRateLimit } from "@/lib/rate-limit";
import { getCompanyBySlug, getCompanySuspendedAt } from "@/modules/companies/queries";
import { createCompanyInvite } from "@/modules/companies/mutations";
import { getCurrentCompany } from "@/modules/companies/actions";
import { checkSuperAdmin, isCurrentUserSuperAdmin } from "@/lib/permissions/super-admin";
import { isCurrentUserCompanyAdmin, requirePermission } from "@/lib/permissions/has-permission";
import { TENANT_READ_ONLY_MESSAGE, requireWritableTenant } from "@/lib/permissions/tenant-access";
import { sendPasswordResetEmail, sendSignupVerificationEmail, sendUserInviteEmail } from "@/lib/email";
import { writeAuditLog } from "@/lib/audit-log";
import { getRequestSiteUrl } from "@/lib/request-origin";
import { getSiteUrl } from "@/lib/site";
import { getPlanById, getSubscriptionForCompany } from "@/modules/billing/queries";
import {
  accountSignupSchema,
  confirmSignupEmailSchema,
  signupPlanIdSchema,
  forgotPasswordSchema,
  inviteUserSchema,
  resetPasswordSchema,
  signInSchema,
  transferCompanyAdminSchema,
} from "./validation";
import { getInviteByToken, getUserWithRole, listCompanyUsers, listPendingInvites } from "./queries";
import {
  acceptCompanyInvite,
  createPasswordRecoveryToken,
  createSignupAccount,
  insertOnboardingUser,
  setUserActive,
  transferCompanyAdmin,
  updateUserRole,
} from "./mutations";
import type {
  AcceptInviteState,
  AccountSignupState,
  CompanyUserSummary,
  ConfirmSignupEmailState,
  CurrentUser,
  ForgotPasswordState,
  InviteDetails,
  InviteUserFormState,
  PendingInviteSummary,
  ResetPasswordState,
  UserActionState,
} from "./types";

/** For /invite/[token] — the page calls this, never queries.ts directly. */
export async function getInviteForAcceptPage(token: string): Promise<InviteDetails | null> {
  return getInviteByToken(token);
}

function redirectToTenantLogin(slug: string, nextPath: string | null, code: string): never {
  const params = new URLSearchParams({ error: code });
  const next = safePostLoginPath(nextPath ?? undefined);
  if (next) {
    params.set("next", next);
  }
  redirect(`/${slug}/login?${params.toString()}`);
}

/**
 * Signs a user into a specific company's tenant login page. `slug` is bound
 * by the page, not taken from the form, then checked against the signed-in
 * user's own company. Success and failure both redirect, so the password
 * never lands in the address bar.
 */
export async function signIn(slug: string, nextPath: string | null, formData: FormData): Promise<never> {
  const fail = (code: string): never => {
    if (!isValidTenantSlug(slug)) {
      redirect("/login?error=missing");
    }
    redirectToTenantLogin(slug, nextPath, code);
  };

  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return fail("invalid");
  }

  // In-process only (single instance). Multi-instance needs Redis — TAGX-019.
  // Successful logins still consume a slot; the window does not reset on success.
  const loginKey = `login:${clientIpFromHeaders(headers())}:${parsed.data.email.toLowerCase()}:${slug}`;
  if (!consumeRateLimit(loginKey, 10, 15 * 60 * 1000)) {
    return fail("rate");
  }

  const company = await getCompanyBySlug(slug);
  if (!company) {
    return fail("missing");
  }

  const supabase = createClient();

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword(
    parsed.data,
  );

  if (authError || !authData.user) {
    return fail("invalid");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("company_id, is_active")
    .eq("id", authData.user.id)
    .maybeSingle<{ company_id: string | null; is_active: boolean }>();

  if (!profile?.company_id) {
    await supabase.auth.signOut();
    return fail("onboarding");
  }

  if (profile.company_id !== company.id) {
    await supabase.auth.signOut();
    return fail("mismatch");
  }

  if (!profile.is_active) {
    await supabase.auth.signOut();
    return fail("invalid");
  }

  if (await getCompanySuspendedAt(company.id)) {
    await supabase.auth.signOut();
    return fail("suspended");
  }

  cookies().set(TENANT_SLUG_COOKIE, slug, {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 400,
  });

  redirect(safePostLoginPath(nextPath ?? undefined) ?? "/dashboard");
}

/**
 * Signs in to the platform-level /admin section. Deliberately separate
 * from `signIn`: there's no company/slug to scope this to, and the check
 * afterward is against `platform_admins`, not `public.users.company_id` —
 * a valid password for a regular tenant account must not grant access here.
 */
export async function signInSuperAdmin(formData: FormData): Promise<never> {
  const fail = (code: string): never => {
    redirect(`/admin/login?error=${code}`);
  };

  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return fail("invalid");
  }

  const adminLoginKey = `admin-login:${clientIpFromHeaders(headers())}:${parsed.data.email.toLowerCase()}`;
  if (!consumeRateLimit(adminLoginKey, 10, 15 * 60 * 1000)) {
    return fail("rate");
  }

  const supabase = createClient();

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword(
    parsed.data,
  );

  if (authError || !authData.user) {
    return fail("invalid");
  }

  if (!(await checkSuperAdmin(supabase, authData.user.id))) {
    await supabase.auth.signOut();
    return fail("forbidden");
  }

  redirect("/admin");
}

/**
 * Public self-serve: create an auth account only. Company, plan, and
 * payment happen after email verification on /onboarding. The
 * verification email goes out through Brevo (lib/email.ts) — Supabase
 * Auth's own mailer is never triggered here.
 */
export async function signupAccountAction(
  _prevState: AccountSignupState,
  formData: FormData,
): Promise<AccountSignupState> {
  const ip = clientIpFromHeaders(headers());
  if (!consumeRateLimit(`account-signup:${ip}`, 5, 60 * 60 * 1000)) {
    return { error: "Too many signup attempts. Try again later." };
  }

  const parsed = accountSignupSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const planIdRaw = formData.get("planId");
  const planId = signupPlanIdSchema.safeParse(planIdRaw).success ? (planIdRaw as string) : null;
  if (planId) {
    cookies().set("tagx-signup-plan", planId, {
      path: "/",
      sameSite: "lax",
      httpOnly: true,
      maxAge: 60 * 60 * 24,
    });
  }

  const account = await createSignupAccount({
    email: parsed.data.email,
    password: parsed.data.password,
    fullName: parsed.data.fullName,
  });
  if ("error" in account) {
    if (account.error === "exists") {
      return { error: "An account with this email already exists. Please sign in or reset your password." };
    }
    return { error: account.message ?? "Could not create your account." };
  }

  const profile = await insertOnboardingUser({
    userId: account.userId,
    email: parsed.data.email,
    fullName: parsed.data.fullName,
  });
  if ("error" in profile && !profile.error.includes("already exists")) {
    return { error: profile.error };
  }

  // Our own confirm page, not Supabase's /verify: no redirect allow-list,
  // no PKCE cookie (works when the link opens in another browser), and a
  // button press instead of a GET so mail scanners can't burn the token.
  const verifyParams = new URLSearchParams({ token_hash: account.tokenHash });
  if (planId) {
    verifyParams.set("plan", planId);
  }
  const verifyUrl = `${getSiteUrl()}/auth/confirm?${verifyParams}`;
  const sent = await sendSignupVerificationEmail({
    to: parsed.data.email,
    recipientName: parsed.data.fullName,
    verifyUrl,
  });
  if ("error" in sent) {
    return { error: "We couldn't send the verification email. Try again in a few minutes." };
  }

  return { error: null, checkEmail: true };
}

/** Auth email-confirm callback. Returns the in-app path to send the user to. */
export async function completeEmailCallbackAction(code: string, nextRaw: string | null): Promise<string> {
  const supabase = createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return "/signup?error=confirm";
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return "/signup";
  }

  let profile = await getUserWithRole(user.id);
  if (!profile) {
    const fullName =
      typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : null;
    await insertOnboardingUser({ userId: user.id, email: user.email, fullName });
    profile = await getUserWithRole(user.id);
  }

  if (profile?.companyId) {
    return "/dashboard";
  }

  return safePostLoginPath(nextRaw ?? undefined) ?? "/onboarding";
}

/**
 * /auth/confirm: verifies the token from the Brevo signup email and signs
 * the user in. Runs on a button press (Server Action), never on page load.
 */
export async function confirmSignupEmailAction(
  _prevState: ConfirmSignupEmailState,
  formData: FormData,
): Promise<ConfirmSignupEmailState> {
  const ip = clientIpFromHeaders(headers());
  if (!consumeRateLimit(`signup-confirm:${ip}`, 10, 15 * 60 * 1000)) {
    return { error: "Too many attempts. Try again later." };
  }

  const parsed = confirmSignupEmailSchema.safeParse({
    tokenHash: formData.get("tokenHash"),
    planId: formData.get("planId") || undefined,
  });
  if (!parsed.success) {
    return { error: "This verification link is invalid or has expired." };
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.verifyOtp({ type: "signup", token_hash: parsed.data.tokenHash });
  const user = data.user;
  if (error || !user?.email) {
    return { error: "This verification link is invalid or has expired. Sign up again to get a new one." };
  }

  let profile = await getUserWithRole(user.id);
  if (!profile) {
    const fullName = typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : null;
    await insertOnboardingUser({ userId: user.id, email: user.email, fullName });
    profile = await getUserWithRole(user.id);
  }

  if (profile?.companyId) {
    redirect("/dashboard");
  }
  redirect(parsed.data.planId ? `/onboarding?plan=${parsed.data.planId}` : "/onboarding");
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
 * Sends a password-reset email through Brevo (lib/email.ts) — Supabase
 * Auth only mints the one-time recovery token and never emails anything
 * itself. Always reports success regardless of whether the address is
 * registered, so this can't be used to enumerate accounts.
 * `afterLoginPath` is baked into the link so /reset-password knows which
 * login page to send the user back to once they're done.
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

  const tokenHash = await createPasswordRecoveryToken(parsed.data.email);
  if (tokenHash) {
    const params = new URLSearchParams({ token_hash: tokenHash, redirect: afterLoginPath });
    await sendPasswordResetEmail({
      to: parsed.data.email,
      resetUrl: `${getSiteUrl()}/reset-password?${params}`,
    });
  }

  return { submitted: true, error: null };
}

/**
 * Completes a password reset from the Brevo email's link. The recovery
 * token is only redeemed here, when the new password is submitted — not
 * when the page loads — so a mail scanner opening the link can't use it up.
 */
export async function updatePasswordAction(
  _prevState: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const ip = clientIpFromHeaders(headers());
  if (!consumeRateLimit(`reset-confirm:${ip}`, 10, 15 * 60 * 1000)) {
    return { success: false, error: "Too many attempts. Try again later." };
  }

  const parsed = resetPasswordSchema.safeParse({
    tokenHash: formData.get("tokenHash"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = createClient();

  const { error: verifyError } = await supabase.auth.verifyOtp({
    type: "recovery",
    token_hash: parsed.data.tokenHash,
  });

  if (verifyError) {
    return { success: false, error: "This reset link is invalid or has expired. Request a new one." };
  }

  const { error: updateError } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (updateError) {
    await supabase.auth.signOut();
    return {
      success: false,
      error:
        updateError.code === "same_password"
          ? "Choose a password different from your current one, then request a new reset link."
          : "Could not update your password. Request a new reset link.",
    };
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

  const subscription = await getSubscriptionForCompany(company.id);
  const plan = subscription ? await getPlanById(subscription.planId) : null;
  if (plan?.userLimit) {
    const [members, pending] = await Promise.all([listCompanyUsers(), listPendingInvites()]);
    const seats =
      members.filter((member) => member.isActive).length + pending.filter((invite) => !invite.isExpired).length;
    if (seats >= plan.userLimit) {
      return { error: `This plan allows ${plan.userLimit} users. Upgrade the plan or deactivate unused accounts.` };
    }
  }

  const inviteKey = `invite:${company.id}:${clientIpFromHeaders(headers())}`;
  if (!consumeRateLimit(inviteKey, 10, 60 * 60 * 1000)) {
    return { error: "Too many invites. Try again later." };
  }

  const supabase = createClient();

  // Confirms the chosen role actually belongs to this company — RLS's
  // roles_tenant_isolation policy means this returns null for any other
  // company's role id, tampered with client-side or not.
  const { data: role } = await supabase
    .from("roles")
    .select("id, name, is_system")
    .eq("id", parsed.data.roleId)
    .maybeSingle<{ id: string; name: string; is_system: boolean }>();
  if (!role) {
    return { error: "Role not found." };
  }
  // One Company Admin per company (migration 0054): invite with a normal
  // role, then use "Transfer Company Admin" once they've joined.
  if (role.is_system && role.name === "Company Admin") {
    return { error: "There can only be one Company Admin. Invite them with another role, then transfer Company Admin to them." };
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

  const inviteUrl = `${getRequestSiteUrl()}/invite/${inviteResult.token}`;

  const emailResult = await sendUserInviteEmail({
    to: parsed.data.email,
    companyName: company.name,
    inviteUrl,
  });

  revalidatePath("/dashboard/administration/users");

  await writeAuditLog({
    action: "user.invited",
    entityType: "company_invite",
    companyId: company.id,
    newValues: { email: parsed.data.email, roleId: parsed.data.roleId },
  });

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

  const roleChangeKey = `user-role-change:${clientIpFromHeaders(headers())}`;
  if (!consumeRateLimit(roleChangeKey, 60, 60 * 60 * 1000)) {
    return { error: "Too many changes. Try again later." };
  }

  const supabase = createClient();
  const { data: role } = await supabase
    .from("roles")
    .select("id, name, is_system")
    .eq("id", roleId)
    .maybeSingle<{ id: string; name: string; is_system: boolean }>();
  if (!role) {
    return { error: "Role not found." };
  }
  // Mirrors update_user_role() (migration 0052): a Company Admin's role is
  // fixed, and the built-in Company Admin role is only granted through
  // "Make company admin".
  if (role.is_system && role.name === "Company Admin") {
    return { error: "Use \"Make company admin\" to give someone Company Admin access." };
  }
  const { data: target } = await supabase
    .from("users")
    .select("is_company_admin")
    .eq("id", userId)
    .maybeSingle<{ is_company_admin: boolean }>();
  if (target?.is_company_admin) {
    return { error: "A Company Admin's role can't be changed." };
  }

  const result = await updateUserRole(userId, roleId);
  if (!result.error) {
    await writeAuditLog({
      action: "user.role_changed",
      entityType: "user",
      entityId: userId,
      newValues: { roleId },
    });
  }
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

  const supabaseAdminCheck = createClient();
  const { data: target } = await supabaseAdminCheck
    .from("users")
    .select("is_company_admin")
    .eq("id", userId)
    .maybeSingle<{ is_company_admin: boolean }>();
  if (!isActive && target?.is_company_admin) {
    return { error: "The company admin can't be deactivated." };
  }

  const result = await setUserActive(userId, isActive);
  if (!result.error) {
    await writeAuditLog({
      action: isActive ? "user.activated" : "user.deactivated",
      entityType: "user",
      entityId: userId,
    });
  }
  revalidatePath("/dashboard/administration/users");
  return result;
}

/**
 * One Company Admin per company: this hands the role to `newAdminId` and
 * moves the current admin to `previousRoleId`. Only the current Company
 * Admin (or a super admin) can do it — re-checked in the database.
 */
export async function transferCompanyAdminAction(
  newAdminId: string,
  previousRoleId: string,
): Promise<UserActionState> {
  if (!(await requireWritableTenant())) {
    return { error: TENANT_READ_ONLY_MESSAGE };
  }

  const adminChangeKey = `company-admin-change:${clientIpFromHeaders(headers())}`;
  if (!consumeRateLimit(adminChangeKey, 10, 60 * 60 * 1000)) {
    return { error: "Too many changes. Try again later." };
  }

  if (!(await isCurrentUserCompanyAdmin()) && !(await isCurrentUserSuperAdmin())) {
    return { error: "Only the Company Admin can transfer this role." };
  }

  const parsed = transferCompanyAdminSchema.safeParse({ newAdminId, previousRoleId });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const result = await transferCompanyAdmin(parsed.data.newAdminId, parsed.data.previousRoleId);
  if (!result.error) {
    await writeAuditLog({
      action: "user.company_admin_transferred",
      entityType: "user",
      entityId: parsed.data.newAdminId,
      newValues: { previousAdminRoleId: parsed.data.previousRoleId },
    });
  }
  revalidatePath("/dashboard/administration/users");
  revalidatePath("/", "layout");
  return result;
}
