import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  clampModulesToPlan,
  defaultModulesForPlan,
  parseEnabledModules,
  parsePlanModules,
} from "@/lib/permissions/feature-catalog";
import type { BillingCycle, BillingPlan, PaymentMethod, PaymentStatus, SubscriptionStatus, SubscriptionType } from "./types";

export type PlanMutationResult = { id: string } | { error: string };
export type MutationResult = { success: true } | { error: string };

export interface UpsertPlanInput {
  name: string;
  description: string | null;
  priceMonthly: number;
  assetLimit: number;
  extraAssetQuantity: number;
  extraAssetPrice: number;
  isActive: boolean;
  sortOrder: number;
  includedModules: string[] | null;
  storageLimitBytes: number | null;
  userLimit: number | null;
}

export async function insertPlan(input: UpsertPlanInput): Promise<PlanMutationResult> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("billing_plans")
    .insert({
      name: input.name,
      description: input.description,
      price_monthly: input.priceMonthly,
      asset_limit: input.assetLimit,
      extra_asset_quantity: input.extraAssetQuantity,
      extra_asset_price: input.extraAssetPrice,
      is_active: input.isActive,
      sort_order: input.sortOrder,
      included_modules: input.includedModules,
      storage_limit_bytes: input.storageLimitBytes,
      user_limit: input.userLimit,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    return { error: "Could not create the plan." };
  }

  return { id: data.id };
}

export async function updatePlan(planId: string, input: UpsertPlanInput): Promise<MutationResult> {
  const supabase = createClient();

  const { error } = await supabase
    .from("billing_plans")
    .update({
      name: input.name,
      description: input.description,
      price_monthly: input.priceMonthly,
      asset_limit: input.assetLimit,
      extra_asset_quantity: input.extraAssetQuantity,
      extra_asset_price: input.extraAssetPrice,
      is_active: input.isActive,
      sort_order: input.sortOrder,
      included_modules: input.includedModules,
      storage_limit_bytes: input.storageLimitBytes,
      user_limit: input.userLimit,
    })
    .eq("id", planId);

  if (error) {
    return { error: "Could not update the plan." };
  }

  return { success: true };
}

export async function deletePlan(planId: string): Promise<MutationResult> {
  const supabase = createClient();

  const { error } = await supabase.from("billing_plans").delete().eq("id", planId);

  if (error) {
    if (error.code === "23503") {
      return { error: "Reassign companies on this plan before deleting it." };
    }
    return { error: "Could not delete the plan." };
  }

  return { success: true };
}

export async function upsertCompanySubscription(
  companyId: string,
  planId: string,
  options: {
    status?: SubscriptionStatus;
    subscriptionType?: SubscriptionType;
    billingCycle?: BillingCycle;
    startsAt?: string | null;
    endsAt?: string | null;
  } = {},
): Promise<MutationResult> {
  const supabase = createAdminClient();

  const { error } = await supabase.from("company_subscriptions").upsert(
    {
      company_id: companyId,
      plan_id: planId,
      status: options.status ?? "active",
      subscription_type: options.subscriptionType ?? "self_service",
      billing_cycle: options.billingCycle ?? "monthly",
      ...(options.startsAt ? { starts_at: options.startsAt } : {}),
      ...(options.endsAt !== undefined ? { ends_at: options.endsAt } : {}),
    },
    { onConflict: "company_id" },
  );

  if (error) {
    return { error: "Could not assign the plan." };
  }

  return { success: true };
}

/** Copies plan storage quota and clamps company modules to what the plan allows. */
export async function applyPlanLimitsToCompany(companyId: string, plan: BillingPlan): Promise<MutationResult> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("company_settings")
    .select("enabled_modules")
    .eq("company_id", companyId)
    .maybeSingle<{ enabled_modules: unknown }>();

  const planModules = parsePlanModules(plan.includedModules);
  const enabled = data
    ? clampModulesToPlan(parseEnabledModules(data.enabled_modules), planModules)
    : defaultModulesForPlan(planModules);

  const patch: Record<string, unknown> = {
    company_id: companyId,
    enabled_modules: enabled,
  };
  if (plan.storageLimitBytes != null) {
    patch.storage_limit_bytes = plan.storageLimitBytes;
  }

  const { error } = await supabase.from("company_settings").upsert(patch, { onConflict: "company_id" });
  if (error) {
    return { error: "Could not apply plan limits." };
  }
  return { success: true };
}

export async function setPlanRazorpayId(planId: string, razorpayPlanId: string): Promise<MutationResult> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("billing_plans")
    .update({ razorpay_plan_id: razorpayPlanId })
    .eq("id", planId);

  if (error) {
    return { error: "Could not save the Razorpay plan." };
  }

  return { success: true };
}

export async function attachRazorpaySubscription(input: {
  companyId: string;
  razorpayCustomerId: string;
  razorpaySubscriptionId: string;
  paymentConfirmToken: string;
}): Promise<MutationResult> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("company_subscriptions")
    .update({
      razorpay_customer_id: input.razorpayCustomerId,
      razorpay_subscription_id: input.razorpaySubscriptionId,
      payment_confirm_token: input.paymentConfirmToken,
    })
    .eq("company_id", input.companyId);

  if (error) {
    return { error: "Could not save the Razorpay subscription." };
  }

  return { success: true };
}

export async function setSubscriptionStatus(
  companyId: string,
  status: SubscriptionStatus,
): Promise<MutationResult> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("company_subscriptions")
    .update(status === "active" ? { status, payment_confirm_token: null } : { status })
    .eq("company_id", companyId);

  if (error) {
    return { error: "Could not update the subscription." };
  }

  return { success: true };
}

export async function setSubscriptionPeriod(
  companyId: string,
  input: { startsAt?: string; endsAt?: string | null; autoRenew?: boolean },
): Promise<MutationResult> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("company_subscriptions")
    .update({
      ...(input.startsAt ? { starts_at: input.startsAt } : {}),
      ...(input.endsAt !== undefined ? { ends_at: input.endsAt } : {}),
      ...(input.autoRenew !== undefined ? { auto_renew: input.autoRenew } : {}),
    })
    .eq("company_id", companyId);
  if (error) {
    return { error: "Could not update the subscription period." };
  }
  return { success: true };
}

export async function insertBillingPayment(input: {
  companyId: string;
  subscriptionId: string | null;
  amount: number;
  currency: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  referenceNumber?: string | null;
  paymentDate: string;
  provider?: string | null;
  notes?: string | null;
  createdBy: string | null;
}): Promise<{ id: string } | { error: string }> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("billing_payments")
    .insert({
      company_id: input.companyId,
      subscription_id: input.subscriptionId,
      amount: input.amount,
      currency: input.currency,
      payment_method: input.paymentMethod,
      payment_status: input.paymentStatus,
      reference_number: input.referenceNumber ?? null,
      payment_date: input.paymentDate,
      provider: input.provider ?? null,
      notes: input.notes ?? null,
      created_by: input.createdBy,
    })
    .select("id")
    .single<{ id: string }>();
  if (error || !data) {
    if (error?.code === "23505") {
      return { id: "duplicate" };
    }
    return { error: "Could not record the payment." };
  }
  return { id: data.id };
}

export async function attachRazorpayOrder(
  orderId: string,
  razorpayOrderId: string,
): Promise<MutationResult> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("billing_orders")
    .update({ razorpay_order_id: razorpayOrderId })
    .eq("id", orderId);

  if (error) {
    return { error: "Could not save the Razorpay order." };
  }

  return { success: true };
}

export async function markBillingOrderPaid(
  orderId: string,
  razorpayPaymentId: string,
): Promise<MutationResult> {
  const supabase = createAdminClient();

  const { error: paymentError } = await supabase
    .from("billing_orders")
    .update({ razorpay_payment_id: razorpayPaymentId })
    .eq("id", orderId);

  if (paymentError) {
    return { error: "Could not record the payment." };
  }

  const { error } = await supabase.rpc("fulfill_billing_order", { p_order_id: orderId });

  if (error) {
    if (error.message.includes("not pending")) {
      return { success: true };
    }
    return { error: "Could not add the extra assets." };
  }

  return { success: true };
}

export async function claimRazorpayWebhookEvent(eventId: string, eventType: string): Promise<boolean> {
  const supabase = createAdminClient();

  const { error } = await supabase.from("razorpay_webhook_events").insert({
    event_id: eventId,
    event_type: eventType,
  });

  if (error) {
    return false;
  }

  return true;
}

export async function incrementExtraAssets(companyId: string, quantity: number): Promise<MutationResult> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("company_subscriptions")
    .select("extra_assets")
    .eq("company_id", companyId)
    .maybeSingle<{ extra_assets: number }>();

  if (error || !data) {
    return { error: "This company has no plan assigned yet." };
  }

  const { error: updateError } = await supabase
    .from("company_subscriptions")
    .update({ extra_assets: data.extra_assets + quantity })
    .eq("company_id", companyId);

  if (updateError) {
    return { error: "Could not add extra assets." };
  }

  return { success: true };
}

export async function insertExtraAssetOrder(input: {
  companyId: string;
  plan: BillingPlan;
  packs: number;
  createdBy: string | null;
}): Promise<{ id: string } | { error: string }> {
  const supabase = createClient();
  const assetQuantity = input.packs * input.plan.extraAssetQuantity;
  const amount = input.packs * input.plan.extraAssetPrice;

  const { data, error } = await supabase
    .from("billing_orders")
    .insert({
      company_id: input.companyId,
      plan_id: input.plan.id,
      packs: input.packs,
      asset_quantity: assetQuantity,
      amount,
      currency: input.plan.currency,
      status: "pending",
      created_by: input.createdBy,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    return { error: "Could not submit the extra-asset request." };
  }

  return { id: data.id };
}

export async function fulfillBillingOrder(orderId: string): Promise<MutationResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc("fulfill_billing_order", { p_order_id: orderId });

  if (error) {
    if (error.message.includes("not pending")) {
      return { error: "This request has already been handled." };
    }
    return { error: "Could not fulfill this request." };
  }

  return { success: true };
}

export async function cancelBillingOrder(orderId: string): Promise<MutationResult> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("billing_orders")
    .update({ status: "canceled" })
    .eq("id", orderId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error) {
    return { error: "Could not cancel this request." };
  }

  if (!data) {
    return { error: "This request has already been handled." };
  }

  return { success: true };
}
