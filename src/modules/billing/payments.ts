import "server-only";
import { randomBytes } from "node:crypto";
import {
  createRazorpayCustomer,
  createRazorpayOrder,
  createRazorpayPlan,
  createRazorpaySubscription,
  getRazorpayKeyId,
  isRazorpayConfigured,
  rupeesToPaise,
  verifyRazorpayPaymentSignature,
  verifyRazorpaySubscriptionSignature,
  verifyRazorpayWebhookSignature,
} from "@/lib/razorpay";
import type { BillingPlan, RazorpayCheckoutSession, SubscriptionStatus } from "./types";
import {
  getBillingOrderById,
  getBillingOrderByRazorpayOrderId,
  getPaymentByReference,
  getPlanById,
  getSubscriptionByConfirmToken,
  getSubscriptionByRazorpayId,
  getSubscriptionForCompany,
} from "./queries";
import {
  attachRazorpayOrder,
  attachRazorpaySubscription,
  claimRazorpayWebhookEvent,
  insertBillingPayment,
  markBillingOrderPaid,
  setPlanRazorpayId,
  setSubscriptionStatus,
} from "./mutations";

export async function syncPlanToRazorpay(plan: BillingPlan): Promise<{ error: string } | { razorpayPlanId: string | null }> {
  if (plan.priceMonthly <= 0) {
    return { razorpayPlanId: null };
  }

  if (!isRazorpayConfigured()) {
    return { razorpayPlanId: plan.razorpayPlanId };
  }

  const created = await createRazorpayPlan({
    name: plan.name,
    description: plan.description,
    priceMonthly: plan.priceMonthly,
    currency: plan.currency,
  });
  if ("error" in created) {
    return { error: created.error };
  }

  const saved = await setPlanRazorpayId(plan.id, created.id);
  if ("error" in saved) {
    return { error: saved.error };
  }

  return { razorpayPlanId: created.id };
}

export async function createSubscriptionCheckout(input: {
  companyId: string;
  plan: BillingPlan;
  email: string;
  customerName: string;
}): Promise<{ checkout: RazorpayCheckoutSession } | { error: string }> {
  if (input.plan.priceMonthly <= 0) {
    return { error: "This plan does not require payment." };
  }

  if (!isRazorpayConfigured()) {
    return { error: "Card payments are not configured yet. Contact TagX." };
  }

  let razorpayPlanId = input.plan.razorpayPlanId;
  if (!razorpayPlanId) {
    const synced = await syncPlanToRazorpay(input.plan);
    if ("error" in synced) {
      return { error: synced.error };
    }
    razorpayPlanId = synced.razorpayPlanId;
  }

  if (!razorpayPlanId) {
    return { error: "This plan is not available for online payment yet." };
  }

  const existing = await getSubscriptionForCompany(input.companyId);
  if (existing?.razorpaySubscriptionId) {
    const confirmToken = existing.paymentConfirmToken ?? randomBytes(24).toString("hex");
    if (!existing.paymentConfirmToken) {
      await attachRazorpaySubscription({
        companyId: input.companyId,
        razorpayCustomerId: existing.razorpayCustomerId ?? "",
        razorpaySubscriptionId: existing.razorpaySubscriptionId,
        paymentConfirmToken: confirmToken,
      });
    }

    return {
      checkout: {
        keyId: getRazorpayKeyId(),
        name: "TagX",
        description: `${input.plan.name} · ${input.plan.assetLimit} assets / month`,
        currency: input.plan.currency,
        amountPaise: rupeesToPaise(input.plan.priceMonthly),
        prefillEmail: input.email,
        prefillName: input.customerName,
        subscriptionId: existing.razorpaySubscriptionId,
        confirmToken,
      },
    };
  }

  const customer = await createRazorpayCustomer({
    name: input.customerName,
    email: input.email,
  });
  if ("error" in customer) {
    return { error: customer.error };
  }

  const subscription = await createRazorpaySubscription({
    razorpayPlanId,
    notes: {
      kind: "signup",
      company_id: input.companyId,
      plan_id: input.plan.id,
    },
  });
  if ("error" in subscription) {
    return { error: subscription.error };
  }

  const confirmToken = randomBytes(24).toString("hex");
  const attached = await attachRazorpaySubscription({
    companyId: input.companyId,
    razorpayCustomerId: customer.id,
    razorpaySubscriptionId: subscription.id,
    paymentConfirmToken: confirmToken,
  });
  if ("error" in attached) {
    return { error: attached.error };
  }

  return {
    checkout: {
      keyId: getRazorpayKeyId(),
      name: "TagX",
      description: `${input.plan.name} · ${input.plan.assetLimit} assets / month`,
      currency: input.plan.currency,
      amountPaise: rupeesToPaise(input.plan.priceMonthly),
      prefillEmail: input.email,
      prefillName: input.customerName,
      subscriptionId: subscription.id,
      confirmToken,
    },
  };
}

export async function createExtraAssetCheckout(input: {
  billingOrderId: string;
  plan: BillingPlan;
  amountRupees: number;
  email: string;
  customerName: string;
}): Promise<{ checkout: RazorpayCheckoutSession } | { error: string }> {
  if (input.amountRupees <= 0) {
    return { error: "This extra pack does not require payment." };
  }

  if (!isRazorpayConfigured()) {
    return { error: "Card payments are not configured yet. Contact TagX." };
  }

  const order = await getBillingOrderById(input.billingOrderId);
  if (!order) {
    return { error: "Could not find that extra-asset request." };
  }

  let razorpayOrderId = order.razorpayOrderId;
  if (!razorpayOrderId) {
    const created = await createRazorpayOrder({
      amountRupees: input.amountRupees,
      currency: order.currency,
      receipt: order.id,
      notes: {
        kind: "extra_assets",
        billing_order_id: order.id,
        company_id: order.companyId,
      },
    });
    if ("error" in created) {
      return { error: created.error };
    }
    razorpayOrderId = created.id;
    const attached = await attachRazorpayOrder(order.id, razorpayOrderId);
    if ("error" in attached) {
      return { error: attached.error };
    }
  }

  return {
    checkout: {
      keyId: getRazorpayKeyId(),
      name: "TagX",
      description: `Extra assets · ${order.assetQuantity} assets`,
      currency: order.currency,
      amountPaise: rupeesToPaise(input.amountRupees),
      prefillEmail: input.email,
      prefillName: input.customerName,
      orderId: razorpayOrderId,
      billingOrderId: order.id,
    },
  };
}

export async function confirmSubscriptionPayment(input: {
  confirmToken: string;
  paymentId: string;
  subscriptionId: string;
  signature: string;
}): Promise<{ error: string } | { companyId: string }> {
  const byToken = await getSubscriptionByConfirmToken(input.confirmToken);
  const subscription = byToken ?? (await getSubscriptionByRazorpayId(input.subscriptionId));
  if (!subscription?.razorpaySubscriptionId) {
    return { error: "This payment session has expired. Sign in and finish paying from Settings." };
  }

  if (subscription.razorpaySubscriptionId !== input.subscriptionId) {
    return { error: "Payment could not be verified." };
  }

  let valid = false;
  try {
    valid = verifyRazorpaySubscriptionSignature({
      subscriptionId: subscription.razorpaySubscriptionId,
      paymentId: input.paymentId,
      signature: input.signature,
    });
  } catch {
    return { error: "Card payments are not configured yet. Contact TagX." };
  }

  if (!valid) {
    return { error: "Payment could not be verified." };
  }

  if (subscription.status !== "active") {
    const activated = await setSubscriptionStatus(subscription.companyId, "active");
    if ("error" in activated) {
      return { error: activated.error };
    }
  }

  return { companyId: subscription.companyId };
}

export async function confirmExtraAssetPayment(input: {
  billingOrderId: string;
  companyId: string;
  paymentId: string;
  orderId: string;
  signature: string;
}): Promise<{ error: string } | { success: true }> {
  const order = await getBillingOrderById(input.billingOrderId);
  if (!order || order.companyId !== input.companyId) {
    return { error: "Could not find that extra-asset request." };
  }

  if (order.status === "fulfilled") {
    return { success: true };
  }

  if (!order.razorpayOrderId || order.razorpayOrderId !== input.orderId) {
    return { error: "Payment could not be verified." };
  }

  let valid = false;
  try {
    valid = verifyRazorpayPaymentSignature({
      orderId: order.razorpayOrderId,
      paymentId: input.paymentId,
      signature: input.signature,
    });
  } catch {
    return { error: "Card payments are not configured yet. Contact TagX." };
  }

  if (!valid) {
    return { error: "Payment could not be verified." };
  }

  const fulfilled = await markBillingOrderPaid(order.id, input.paymentId);
  if ("error" in fulfilled) {
    return { error: fulfilled.error };
  }

  return { success: true };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function entityFrom(wrapper: unknown): Record<string, unknown> | null {
  const record = asRecord(wrapper);
  return asRecord(record?.entity);
}

export async function processRazorpayWebhook(rawBody: string, signature: string | null): Promise<{ status: number }> {
  if (!signature || !verifyRazorpayWebhookSignature(rawBody, signature)) {
    return { status: 400 };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody) as unknown;
  } catch {
    return { status: 400 };
  }

  const body = asRecord(parsed);
  if (!body) {
    return { status: 400 };
  }

  const event = asString(body.event);
  if (!event) {
    return { status: 400 };
  }

  const payload = asRecord(body.payload);
  const payment = entityFrom(payload?.payment);
  const subscription = entityFrom(payload?.subscription);
  const order = entityFrom(payload?.order);
  const paymentId = asString(payment?.id);
  const orderId = asString(payment?.order_id) ?? asString(order?.id);
  const subscriptionId = asString(subscription?.id);
  const createdAt = typeof body.created_at === "number" ? String(body.created_at) : "0";
  const eventId =
    asString(body.id) ?? `${event}:${paymentId ?? subscriptionId ?? orderId ?? "unknown"}:${createdAt}`;

  const claimed = await claimRazorpayWebhookEvent(eventId, event);
  if (!claimed) {
    return { status: 200 };
  }

  if ((event === "payment.captured" || event === "order.paid") && orderId) {
    const extraOrder = await getBillingOrderByRazorpayOrderId(orderId);
    if (extraOrder && extraOrder.status === "pending") {
      await markBillingOrderPaid(extraOrder.id, paymentId ?? orderId);
    }
  }

  if (event === "payment.failed" && paymentId) {
    const failedSubId = subscriptionId ?? asString(payment?.subscription_id);
    const companySub = failedSubId ? await getSubscriptionByRazorpayId(failedSubId) : null;
    if (companySub) {
      await recordVerifiedRazorpayPayment({
        companyId: companySub.companyId,
        subscriptionId: companySub.id,
        paymentId,
        amountPaise: typeof payment?.amount === "number" ? payment.amount : null,
        status: "failed",
      });
      if (companySub.status === "active" || companySub.status === "pending_payment" || companySub.status === "trial") {
        await setSubscriptionStatus(companySub.companyId, "past_due");
      }
    }
  }

  if (subscriptionId) {
    const companySub = await getSubscriptionByRazorpayId(subscriptionId);
    if (companySub) {
      const nextStatus = subscriptionStatusFromEvent(event, asString(subscription?.status));
      if (nextStatus) {
        await setSubscriptionStatus(companySub.companyId, nextStatus);
      }
      if (
        paymentId &&
        (event === "subscription.charged" || event === "payment.captured" || event === "subscription.activated")
      ) {
        await recordVerifiedRazorpayPayment({
          companyId: companySub.companyId,
          subscriptionId: companySub.id,
          paymentId,
          amountPaise: typeof payment?.amount === "number" ? payment.amount : null,
          status: "paid",
        });
      }
    }
  }

  return { status: 200 };
}

async function recordVerifiedRazorpayPayment(input: {
  companyId: string;
  subscriptionId: string | null;
  paymentId: string;
  amountPaise: number | null;
  status: "paid" | "failed";
}): Promise<void> {
  const existing = await getPaymentByReference("razorpay", input.paymentId);
  if (existing) {
    return;
  }
  const subscription = await getSubscriptionForCompany(input.companyId);
  const plan = subscription ? await getPlanById(subscription.planId) : null;
  const amount =
    input.amountPaise != null ? Math.round(input.amountPaise / 100) : (plan?.priceMonthly ?? 0);
  await insertBillingPayment({
    companyId: input.companyId,
    subscriptionId: input.subscriptionId,
    amount,
    currency: plan?.currency ?? "INR",
    paymentMethod: "razorpay",
    paymentStatus: input.status,
    referenceNumber: input.paymentId,
    paymentDate: new Date().toISOString().slice(0, 10),
    provider: "razorpay",
    createdBy: null,
  });
}

function subscriptionStatusFromEvent(event: string, razorpayStatus: string | null): SubscriptionStatus | null {
  if (event === "subscription.activated" || event === "subscription.charged") {
    return "active";
  }
  if (event === "subscription.pending") {
    return "past_due";
  }
  if (event === "subscription.halted") {
    return "halted";
  }
  if (event === "subscription.cancelled" || event === "subscription.completed") {
    return "canceled";
  }
  if (razorpayStatus === "active" || razorpayStatus === "authenticated") {
    return "active";
  }
  return null;
}
