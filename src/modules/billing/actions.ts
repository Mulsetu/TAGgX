"use server";

import "server-only";
import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { TENANT_HEADERS, TENANT_SLUG_COOKIE } from "@/lib/tenant";
import { writeAuditLog } from "@/lib/audit-log";
import { clientIpFromHeaders, consumeRateLimit } from "@/lib/rate-limit";
import { isCurrentUserSuperAdmin } from "@/lib/permissions/super-admin";
import { requirePermission } from "@/lib/permissions/has-permission";
import { TENANT_READ_ONLY_MESSAGE, requireWritableTenant } from "@/lib/permissions/tenant-access";
import { createClient } from "@/lib/supabase/server";
import {
  createCompany,
  deleteCompany,
  seedCompanyPlatformCatalogs,
  updateCompanyLogoAdmin,
} from "@/modules/companies/mutations";
import { getCompanyById, getCompanyBySlug } from "@/modules/companies/queries";
import { createSystemAdminRole, seedDefaultCompanyRoles } from "@/modules/roles/mutations";
import { seedDefaultAssetStatuses } from "@/modules/statuses/mutations";
import { seedDefaultAssetConditions } from "@/modules/conditions/mutations";
import { attachUserToCompany, detachUserFromCompany } from "@/modules/users/mutations";
import { getUserWithRole } from "@/modules/users/queries";
import { uploadFileToR2 } from "@/modules/storage/mutations";
import { parsePlanModules } from "@/lib/permissions/feature-catalog";
import {
  assignPlanSchema,
  extraAssetOrderSchema,
  grantExtraAssetsSchema,
  planFormSchema,
  razorpayPaymentResultSchema,
  createWorkspaceSchema,
  recordPaymentSchema,
  subscriptionStatusSchema,
} from "./validation";
import {
  countAssetsForCompany,
  countPlanSubscriptions,
  getPlanById,
  getSubscriptionForCompany,
  listActivePlans,
  listAllPlans,
  listBillingOrders,
  listBillingOrdersForCompany,
  listCompanyBillingSnapshots,
  listPaymentsForCompany,
  listRecentPayments,
} from "./queries";
import {
  cancelBillingOrder,
  deletePlan,
  fulfillBillingOrder,
  incrementExtraAssets,
  insertBillingPayment,
  insertExtraAssetOrder,
  applyPlanLimitsToCompany,
  insertPlan,
  markBillingOrderPaid,
  setSubscriptionPeriod,
  setSubscriptionStatus,
  updatePlan,
  upsertCompanySubscription,
} from "./mutations";
import {
  confirmExtraAssetPayment,
  confirmSubscriptionPayment,
  createExtraAssetCheckout,
  createSubscriptionCheckout,
  processRazorpayWebhook,
  syncPlanToRazorpay,
} from "./payments";
import type {
  AssignPlanState,
  BillingOrder,
  BillingPayment,
  BillingPlan,
  CompanyAssetQuota,
  CompanyBillingSnapshot,
  ConfirmPaymentState,
  CreateWorkspaceState,
  ExtraAssetOrderState,
  OrderActionState,
  PlanFormState,
  RecordPaymentState,
  SignupState,
  SubscriptionActionState,
  SubscriptionStatus,
} from "./types";

function quotaFrom(
  plan: BillingPlan | null,
  extraAssets: number,
  assetCount: number,
  subscriptionStatus: CompanyAssetQuota["subscriptionStatus"],
): CompanyAssetQuota {
  const effectiveLimit = plan ? plan.assetLimit + extraAssets : null;
  const entitled =
    subscriptionStatus === "none" || subscriptionStatus === "active" || subscriptionStatus === "trial";
  const remaining = entitled ? (effectiveLimit === null ? null : Math.max(0, effectiveLimit - assetCount)) : 0;

  return {
    plan,
    extraAssets,
    assetCount,
    effectiveLimit,
    remaining,
    atLimit: !entitled || (remaining !== null && remaining <= 0),
    subscriptionStatus,
  };
}

const GIB = 1024 * 1024 * 1024;

function readPlanForm(formData: FormData) {
  const allModules = formData.get("allModules") === "on";
  const selected = formData.getAll("includedModule").filter((value): value is string => typeof value === "string");
  const includedModules = allModules ? null : parsePlanModules(selected);
  const storageGb = formData.get("storageLimitGb");
  const storageLimitBytes =
    typeof storageGb === "string" && storageGb.trim() !== ""
      ? Math.round(Number(storageGb) * GIB)
      : null;

  return {
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    priceMonthly: formData.get("priceMonthly"),
    assetLimit: formData.get("assetLimit"),
    extraAssetQuantity: formData.get("extraAssetQuantity"),
    extraAssetPrice: formData.get("extraAssetPrice"),
    isActive: formData.get("isActive") === "on",
    sortOrder: formData.get("sortOrder") ?? 0,
    includedModules,
    storageLimitBytes: Number.isFinite(storageLimitBytes) ? storageLimitBytes : null,
    userLimit: formData.get("userLimit"),
  };
}

export async function getActivePlansForPublic(): Promise<BillingPlan[]> {
  try {
    return await listActivePlans();
  } catch {
    return [];
  }
}

export async function getAllPlansForAdmin(): Promise<BillingPlan[]> {
  if (!(await isCurrentUserSuperAdmin())) {
    return [];
  }
  return listAllPlans();
}

export async function getPlanForSignup(planId: string): Promise<BillingPlan | null> {
  const plans = await getActivePlansForPublic();
  return plans.find((item) => item.id === planId) ?? null;
}

export async function getCompanyBillingSnapshotsForAdmin(): Promise<CompanyBillingSnapshot[]> {
  if (!(await isCurrentUserSuperAdmin())) {
    return [];
  }
  return listCompanyBillingSnapshots();
}

export async function getPendingBillingOrdersForAdmin(): Promise<BillingOrder[]> {
  if (!(await isCurrentUserSuperAdmin())) {
    return [];
  }
  return listBillingOrders("pending");
}

export async function getCurrentCompanyQuota(): Promise<CompanyAssetQuota> {
  const companyId = headers().get(TENANT_HEADERS.companyId);
  if (!companyId) {
    return quotaFrom(null, 0, 0, "none");
  }

  const [subscription, assetCount] = await Promise.all([
    getSubscriptionForCompany(companyId),
    countAssetsForCompany(companyId),
  ]);

  if (!subscription) {
    return quotaFrom(null, 0, assetCount, "none");
  }

  const plan = await getPlanById(subscription.planId);
  return quotaFrom(plan, subscription.extraAssets, assetCount, subscription.status);
}

export async function getCurrentCompanyBillingOrders(): Promise<BillingOrder[]> {
  if (!(await requirePermission("settings", "view"))) {
    return [];
  }

  const companyId = headers().get(TENANT_HEADERS.companyId);
  if (!companyId) {
    return [];
  }

  return listBillingOrdersForCompany(companyId);
}

/**
 * Called from createAssetAction before insert. Companies with no plan
 * (legacy, or not yet assigned) are not capped.
 */
export async function assertCanCreateAsset(): Promise<{ error: string } | { ok: true }> {
  if (!(await requireWritableTenant())) {
    return { error: TENANT_READ_ONLY_MESSAGE };
  }

  const quota = await getCurrentCompanyQuota();

  if (quota.subscriptionStatus === "pending_payment") {
    return { error: "Complete your Razorpay payment in Settings before adding assets." };
  }
  if (quota.subscriptionStatus === "past_due" || quota.subscriptionStatus === "halted") {
    return { error: "Your subscription payment failed. Pay again from Settings to add assets." };
  }
  if (quota.subscriptionStatus === "canceled") {
    return { error: "Your plan is canceled. Choose a plan in Settings to add assets." };
  }

  if (!quota.atLimit || quota.effectiveLimit === null) {
    return { ok: true };
  }

  const limit = quota.effectiveLimit;
  return {
    error: `You've reached your plan's ${limit}-asset limit. Buy extra assets in Settings.`,
  };
}

export async function createPlanAction(
  _prevState: PlanFormState,
  formData: FormData,
): Promise<PlanFormState> {
  if (!(await isCurrentUserSuperAdmin())) {
    return { error: "Not authorized." };
  }

  const parsed = planFormSchema.safeParse(readPlanForm(formData));

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  if (parsed.data.includedModules && parsed.data.includedModules.length === 0) {
    return { error: "Select at least one module, or include every module." };
  }

  const result = await insertPlan({
    ...parsed.data,
    includedModules: parsePlanModules(parsed.data.includedModules),
  });
  if ("error" in result) {
    return { error: result.error };
  }

  const created = await getPlanById(result.id);
  if (created && created.priceMonthly > 0) {
    const synced = await syncPlanToRazorpay(created);
    if ("error" in synced) {
      return { error: synced.error };
    }
  }

  revalidatePath("/admin/plans");
  revalidatePath("/");
  revalidatePath("/signup");

  return { error: null, success: true };
}

export async function updatePlanAction(
  planId: string,
  _prevState: PlanFormState,
  formData: FormData,
): Promise<PlanFormState> {
  if (!(await isCurrentUserSuperAdmin())) {
    return { error: "Not authorized." };
  }

  const parsed = planFormSchema.safeParse(readPlanForm(formData));

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  if (parsed.data.includedModules && parsed.data.includedModules.length === 0) {
    return { error: "Select at least one module, or include every module." };
  }

  const result = await updatePlan(planId, {
    ...parsed.data,
    includedModules: parsePlanModules(parsed.data.includedModules),
  });
  if ("error" in result) {
    return { error: result.error };
  }

  const updated = await getPlanById(planId);
  if (updated && updated.priceMonthly > 0) {
    const synced = await syncPlanToRazorpay(updated);
    if ("error" in synced) {
      return { error: synced.error };
    }
  }

  revalidatePath("/admin/plans");
  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/signup");

  return { error: null, success: true };
}

export async function deletePlanAction(planId: string): Promise<PlanFormState> {
  if (!(await isCurrentUserSuperAdmin())) {
    return { error: "Not authorized." };
  }

  const inUse = await countPlanSubscriptions(planId);
  if (inUse > 0) {
    return { error: `This plan is assigned to ${inUse} ${inUse === 1 ? "company" : "companies"}. Reassign them first.` };
  }

  const result = await deletePlan(planId);
  if ("error" in result) {
    return { error: result.error };
  }

  revalidatePath("/admin/plans");
  revalidatePath("/");
  revalidatePath("/signup");

  return { error: null, success: true };
}

export async function assignPlanToCompanyAction(
  companyId: string,
  _prevState: AssignPlanState,
  formData: FormData,
): Promise<AssignPlanState> {
  if (!(await isCurrentUserSuperAdmin())) {
    return { error: "Not authorized." };
  }

  const parsed = assignPlanSchema.safeParse({ planId: formData.get("planId") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Choose a plan." };
  }

  const plan = await getPlanById(parsed.data.planId);
  if (!plan) {
    return { error: "Plan not found." };
  }

  const result = await upsertCompanySubscription(companyId, parsed.data.planId);
  if ("error" in result) {
    return { error: result.error };
  }

  const limits = await applyPlanLimitsToCompany(companyId, plan);
  if ("error" in limits) {
    return { error: limits.error };
  }

  await writeAuditLog({
    action: "plan.changed",
    entityType: "company_subscription",
    entityId: companyId,
    companyId,
    newValues: { planId: plan.id },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/orders");
  revalidatePath("/dashboard/administration/settings");

  return { error: null, success: true };
}

export async function grantExtraAssetsAction(
  companyId: string,
  _prevState: AssignPlanState,
  formData: FormData,
): Promise<AssignPlanState> {
  if (!(await isCurrentUserSuperAdmin())) {
    return { error: "Not authorized." };
  }

  const parsed = grantExtraAssetsSchema.safeParse({ quantity: formData.get("quantity") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid quantity." };
  }

  const result = await incrementExtraAssets(companyId, parsed.data.quantity);
  if ("error" in result) {
    return { error: result.error };
  }

  revalidatePath("/admin");
  revalidatePath("/dashboard/administration/settings");
  revalidatePath("/assets");

  return { error: null, success: true };
}

export async function fulfillBillingOrderAction(orderId: string): Promise<OrderActionState> {
  if (!(await isCurrentUserSuperAdmin())) {
    return { error: "Not authorized." };
  }

  const result = await fulfillBillingOrder(orderId);
  if ("error" in result) {
    return { error: result.error };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/orders");
  revalidatePath("/dashboard/administration/settings");
  revalidatePath("/assets");

  return { error: null, success: true };
}

export async function cancelBillingOrderAction(orderId: string): Promise<OrderActionState> {
  if (!(await isCurrentUserSuperAdmin())) {
    return { error: "Not authorized." };
  }

  const result = await cancelBillingOrder(orderId);
  if ("error" in result) {
    return { error: result.error };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/orders");
  revalidatePath("/dashboard/administration/settings");

  return { error: null, success: true };
}

export async function requestExtraAssetsAction(
  _prevState: ExtraAssetOrderState,
  formData: FormData,
): Promise<ExtraAssetOrderState> {
  if (!(await requirePermission("settings", "edit"))) {
    return { error: "You don't have permission to change the plan." };
  }

  const companyId = headers().get(TENANT_HEADERS.companyId);
  if (!companyId) {
    return { error: "Could not determine your company." };
  }

  const ip = clientIpFromHeaders(headers());
  if (!consumeRateLimit(`extra-assets:${companyId}:${ip}`, 10, 60 * 60 * 1000)) {
    return { error: "Too many requests. Try again later." };
  }

  const parsed = extraAssetOrderSchema.safeParse({ packs: formData.get("packs") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Choose how many packs." };
  }

  const subscription = await getSubscriptionForCompany(companyId);
  if (!subscription || subscription.status !== "active") {
    return { error: "Your company doesn't have a plan yet. Contact TagX." };
  }

  const plan = await getPlanById(subscription.planId);
  if (!plan) {
    return { error: "Your plan could not be loaded." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const result = await insertExtraAssetOrder({
    companyId,
    plan,
    packs: parsed.data.packs,
    createdBy: user?.id ?? null,
  });

  if ("error" in result) {
    return { error: result.error };
  }

  const amount = parsed.data.packs * plan.extraAssetPrice;
  if (amount <= 0) {
    const fulfilled = await markBillingOrderPaid(result.id, "free");
    if ("error" in fulfilled) {
      return { error: fulfilled.error };
    }
    revalidatePath("/dashboard/administration/settings");
    revalidatePath("/assets");
    return { error: null, success: true };
  }

  const checkout = await createExtraAssetCheckout({
    billingOrderId: result.id,
    plan,
    amountRupees: amount,
    email: user?.email ?? "",
    customerName: "",
  });
  if ("error" in checkout) {
    return { error: checkout.error };
  }

  return { error: null, checkout: checkout.checkout };
}

/**
 * Authenticated self-serve: the account already exists. Creates the
 * workspace, attaches this user as Company Admin, and starts payment if
 * the plan is paid. Does not create fake ₹0 payment rows for free plans.
 */
export async function createWorkspaceForCurrentUserAction(
  _prevState: CreateWorkspaceState,
  formData: FormData,
): Promise<CreateWorkspaceState> {
  const ip = clientIpFromHeaders(headers());
  if (!consumeRateLimit(`onboarding:${ip}`, 5, 60 * 60 * 1000)) {
    return { error: "Too many attempts. Try again later." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return { error: "Sign in to create a workspace." };
  }
  if (!user.email_confirmed_at) {
    return { error: "Verify your email before creating a workspace." };
  }

  const profile = await getUserWithRole(user.id);
  if (profile?.companyId) {
    return { error: "You already have a workspace.", redirectPath: "/dashboard" };
  }

  const parsed = createWorkspaceSchema.safeParse({
    planId: formData.get("planId"),
    name: formData.get("name"),
    slug: formData.get("slug"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const plan = await getPlanById(parsed.data.planId);
  if (!plan || !plan.isActive) {
    return { error: "That plan is no longer available. Pick another one." };
  }

  const existing = await getCompanyBySlug(parsed.data.slug);
  if (existing) {
    return { error: "This workspace URL is already in use. Please choose another." };
  }

  const companyResult = await createCompany({
    name: parsed.data.name,
    slug: parsed.data.slug,
    isDedicatedInfra: false,
  });
  if ("error" in companyResult) {
    return { error: companyResult.error };
  }

  const companyId = companyResult.id;
  let userAttached = false;
  // If attachUserToCompany already ran, detach first: users.company_id
  // cascades on company delete, and deleting the company while the
  // caller's own profile row still points at it would delete that row
  // too, stranding the account (see detachUserFromCompany's doc comment).
  const rollback = async () => {
    if (userAttached) {
      await detachUserFromCompany(user.id);
    }
    await deleteCompany(companyId);
  };

  const roleResult = await createSystemAdminRole(companyId);
  if ("error" in roleResult) {
    await rollback();
    return { error: roleResult.error };
  }
  const defaultRoles = await seedDefaultCompanyRoles(companyId);
  if (defaultRoles.error) {
    await rollback();
    return { error: defaultRoles.error };
  }
  const statusSeedResult = await seedDefaultAssetStatuses(companyId);
  if (statusSeedResult.error) {
    await rollback();
    return { error: statusSeedResult.error };
  }
  const conditionSeedResult = await seedDefaultAssetConditions(companyId);
  if (conditionSeedResult.error) {
    await rollback();
    return { error: conditionSeedResult.error };
  }
  const catalogSeedResult = await seedCompanyPlatformCatalogs(companyId);
  if (catalogSeedResult.error) {
    await rollback();
    return { error: catalogSeedResult.error };
  }

  const attached = await attachUserToCompany({
    userId: user.id,
    companyId,
    roleId: roleResult.id,
    isCompanyAdmin: true,
  });
  if (attached.error) {
    await rollback();
    return { error: attached.error };
  }
  userAttached = true;

  const paidPlan = plan.priceMonthly > 0;
  const subResult = await upsertCompanySubscription(companyId, plan.id, {
    status: paidPlan ? "pending_payment" : "active",
    subscriptionType: "self_service",
  });
  if ("error" in subResult) {
    await rollback();
    return { error: subResult.error };
  }

  const limits = await applyPlanLimitsToCompany(companyId, plan);
  if ("error" in limits) {
    await rollback();
    return { error: limits.error };
  }

  const logoFile = formData.get("logo");
  if (logoFile instanceof File && logoFile.size > 0) {
    const uploadResult = await uploadFileToR2({ companyId, folder: "branding", file: logoFile });
    if (!("error" in uploadResult)) {
      await updateCompanyLogoAdmin(companyId, uploadResult.url);
    }
  }

  await writeAuditLog({
    action: "company.created",
    entityType: "company",
    entityId: companyId,
    companyId,
    newValues: { slug: parsed.data.slug, planId: plan.id, type: "self_service" },
  });

  cookies().set(TENANT_SLUG_COOKIE, parsed.data.slug, {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 400,
  });
  cookies().delete("tagx-signup-plan");

  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/dashboard");

  if (!paidPlan) {
    return { error: null, redirectPath: "/dashboard" };
  }

  const checkout = await createSubscriptionCheckout({
    companyId,
    plan,
    email: user.email,
    customerName: profile?.fullName ?? parsed.data.name,
  });
  if ("error" in checkout) {
    return {
      error: "Your payment could not be completed. Your workspace has been saved. You can retry payment or contact support.",
      redirectPath: "/dashboard",
    };
  }

  return { error: null, checkout: checkout.checkout, redirectPath: "/dashboard" };
}

export async function confirmSignupPaymentAction(
  _prevState: ConfirmPaymentState,
  formData: FormData,
): Promise<ConfirmPaymentState> {
  const parsed = razorpayPaymentResultSchema.safeParse({
    razorpayPaymentId: formData.get("razorpayPaymentId"),
    razorpaySignature: formData.get("razorpaySignature"),
    razorpaySubscriptionId: formData.get("razorpaySubscriptionId") || undefined,
    confirmToken: formData.get("confirmToken") || undefined,
  });

  if (!parsed.success || !parsed.data.confirmToken || !parsed.data.razorpaySubscriptionId) {
    return { error: "Payment could not be verified." };
  }

  const result = await confirmSubscriptionPayment({
    confirmToken: parsed.data.confirmToken,
    paymentId: parsed.data.razorpayPaymentId,
    subscriptionId: parsed.data.razorpaySubscriptionId,
    signature: parsed.data.razorpaySignature,
  });
  if ("error" in result) {
    return { error: result.error };
  }

  const subscription = await getSubscriptionForCompany(result.companyId);
  const plan = subscription ? await getPlanById(subscription.planId) : null;
  if (plan && parsed.data.razorpayPaymentId) {
    await insertBillingPayment({
      companyId: result.companyId,
      subscriptionId: subscription?.id ?? null,
      amount: plan.priceMonthly,
      currency: plan.currency,
      paymentMethod: "razorpay",
      paymentStatus: "paid",
      referenceNumber: parsed.data.razorpayPaymentId,
      paymentDate: new Date().toISOString().slice(0, 10),
      provider: "razorpay",
      createdBy: (await createClient().auth.getUser()).data.user?.id ?? null,
    });
  }

  await writeAuditLog({
    action: "subscription.activated",
    entityType: "company_subscription",
    entityId: subscription?.id ?? result.companyId,
    companyId: result.companyId,
    newValues: { provider: "razorpay", paymentId: parsed.data.razorpayPaymentId },
  });

  revalidatePath("/admin");
  revalidatePath("/dashboard/administration/settings");
  revalidatePath("/assets");
  revalidatePath("/dashboard");

  return {
    error: null,
    success: true,
    redirectPath: "/dashboard",
  };
}

export async function confirmExtraAssetPaymentAction(
  _prevState: ConfirmPaymentState,
  formData: FormData,
): Promise<ConfirmPaymentState> {
  if (!(await requirePermission("settings", "edit"))) {
    return { error: "You don't have permission to change the plan." };
  }

  const companyId = headers().get(TENANT_HEADERS.companyId);
  if (!companyId) {
    return { error: "Could not determine your company." };
  }

  const parsed = razorpayPaymentResultSchema.safeParse({
    razorpayPaymentId: formData.get("razorpayPaymentId"),
    razorpaySignature: formData.get("razorpaySignature"),
    razorpayOrderId: formData.get("razorpayOrderId") || undefined,
    billingOrderId: formData.get("billingOrderId") || undefined,
  });

  if (!parsed.success || !parsed.data.razorpayOrderId || !parsed.data.billingOrderId) {
    return { error: "Payment could not be verified." };
  }

  const result = await confirmExtraAssetPayment({
    billingOrderId: parsed.data.billingOrderId,
    companyId,
    paymentId: parsed.data.razorpayPaymentId,
    orderId: parsed.data.razorpayOrderId,
    signature: parsed.data.razorpaySignature,
  });
  if ("error" in result) {
    return { error: result.error };
  }

  revalidatePath("/dashboard/administration/settings");
  revalidatePath("/admin/orders");
  revalidatePath("/assets");

  return { error: null, success: true };
}

export async function startPlanPaymentAction(): Promise<SignupState> {
  if (!(await requirePermission("settings", "edit"))) {
    return { error: "You don't have permission to change the plan." };
  }

  const companyId = headers().get(TENANT_HEADERS.companyId);
  if (!companyId) {
    return { error: "Could not determine your company." };
  }

  const [company, subscription] = await Promise.all([
    getCompanyById(companyId),
    getSubscriptionForCompany(companyId),
  ]);
  if (!company || !subscription) {
    return { error: "No plan is assigned to this workspace yet." };
  }

  if (subscription.status === "active") {
    return { error: "This workspace is already paid up." };
  }

  const plan = await getPlanById(subscription.planId);
  if (!plan || plan.priceMonthly <= 0) {
    return { error: "This plan does not require payment." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const checkout = await createSubscriptionCheckout({
    companyId,
    plan,
    email: user?.email ?? "",
    customerName: company.name,
  });
  if ("error" in checkout) {
    return { error: checkout.error };
  }

  return { error: null, checkout: checkout.checkout };
}

export async function getPaymentsForCurrentCompany(): Promise<BillingPayment[]> {
  if (!(await requirePermission("settings", "view"))) {
    return [];
  }
  const companyId = headers().get(TENANT_HEADERS.companyId);
  if (!companyId) {
    return [];
  }
  return listPaymentsForCompany(companyId);
}

export async function getRecentPaymentsForAdmin(): Promise<BillingPayment[]> {
  if (!(await isCurrentUserSuperAdmin())) {
    return [];
  }
  return listRecentPayments();
}

export async function recordPaymentAction(
  companyId: string,
  _prevState: RecordPaymentState,
  formData: FormData,
): Promise<RecordPaymentState> {
  if (!(await isCurrentUserSuperAdmin())) {
    return { error: "Not authorized." };
  }

  const parsed = recordPaymentSchema.safeParse({
    amount: formData.get("amount"),
    currency: formData.get("currency") || "INR",
    paymentMethod: formData.get("paymentMethod"),
    paymentStatus: formData.get("paymentStatus"),
    referenceNumber: formData.get("referenceNumber") || null,
    paymentDate: formData.get("paymentDate"),
    notes: formData.get("paymentNotes") || null,
    activate: formData.get("activate") === "on",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid payment details." };
  }

  const subscription = await getSubscriptionForCompany(companyId);
  const supabase = createClient();
  const {
    data: { user: actor },
  } = await supabase.auth.getUser();

  const payment = await insertBillingPayment({
    companyId,
    subscriptionId: subscription?.id ?? null,
    amount: parsed.data.amount,
    currency: parsed.data.currency,
    paymentMethod: parsed.data.paymentMethod,
    paymentStatus: parsed.data.paymentStatus,
    referenceNumber: parsed.data.referenceNumber ?? null,
    paymentDate: parsed.data.paymentDate,
    notes: parsed.data.notes ?? null,
    createdBy: actor?.id ?? null,
  });
  if ("error" in payment) {
    return { error: payment.error };
  }

  if (parsed.data.activate && parsed.data.paymentStatus === "paid") {
    const activated = await setSubscriptionStatus(companyId, "active");
    if ("error" in activated) {
      return { error: activated.error };
    }
    await writeAuditLog({
      action: "subscription.activated",
      entityType: "company_subscription",
      entityId: subscription?.id ?? companyId,
      companyId,
      newValues: { source: "manual_payment", paymentId: payment.id },
    });
  }

  await writeAuditLog({
    action: "payment.recorded",
    entityType: "billing_payment",
    entityId: payment.id,
    companyId,
    newValues: {
      amount: parsed.data.amount,
      method: parsed.data.paymentMethod,
      status: parsed.data.paymentStatus,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/payments");
  revalidatePath("/dashboard/administration/settings");
  return { error: null, success: true };
}

export async function updateSubscriptionStatusAction(
  companyId: string,
  status: SubscriptionStatus,
): Promise<SubscriptionActionState> {
  if (!(await isCurrentUserSuperAdmin())) {
    return { error: "Not authorized." };
  }

  const parsed = subscriptionStatusSchema.safeParse({ status });
  if (!parsed.success) {
    return { error: "Invalid subscription status." };
  }

  const result = await setSubscriptionStatus(companyId, parsed.data.status);
  if ("error" in result) {
    return { error: result.error };
  }

  const action =
    parsed.data.status === "active"
      ? "subscription.activated"
      : parsed.data.status === "suspended"
        ? "subscription.suspended"
        : parsed.data.status === "canceled"
          ? "subscription.cancelled"
          : "subscription.updated";

  await writeAuditLog({
    action,
    entityType: "company_subscription",
    entityId: companyId,
    companyId,
    newValues: { status: parsed.data.status },
  });

  revalidatePath("/admin");
  revalidatePath("/dashboard/administration/settings");
  return { error: null, success: true };
}

export async function extendSubscriptionAction(
  companyId: string,
  _prevState: SubscriptionActionState,
  formData: FormData,
): Promise<SubscriptionActionState> {
  if (!(await isCurrentUserSuperAdmin())) {
    return { error: "Not authorized." };
  }

  const endsAt = String(formData.get("endsAt") ?? "").trim();
  if (!endsAt) {
    return { error: "Choose an end date." };
  }

  const result = await setSubscriptionPeriod(companyId, { endsAt: new Date(endsAt).toISOString() });
  if ("error" in result) {
    return { error: result.error };
  }

  await writeAuditLog({
    action: "subscription.extended",
    entityType: "company_subscription",
    entityId: companyId,
    companyId,
    newValues: { endsAt },
  });

  revalidatePath("/admin");
  return { error: null, success: true };
}

export async function handleRazorpayWebhookAction(
  rawBody: string,
  signature: string | null,
): Promise<{ status: number }> {
  const result = await processRazorpayWebhook(rawBody, signature);
  if (result.status === 200) {
    revalidatePath("/admin");
    revalidatePath("/admin/orders");
    revalidatePath("/dashboard/administration/settings");
    revalidatePath("/assets");
  }
  return result;
}

