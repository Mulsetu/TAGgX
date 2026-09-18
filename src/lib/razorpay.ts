import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import Razorpay from "razorpay";

export class RazorpayConfigError extends Error {
  constructor(message = "Razorpay is not configured.") {
    super(message);
    this.name = "RazorpayConfigError";
  }
}

export function getRazorpayKeyId(): string {
  const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID?.trim();
  if (!keyId) {
    throw new RazorpayConfigError();
  }
  return keyId;
}

function getRazorpayKeySecret(): string {
  const secret = process.env.RAZORPAY_KEY_SECRET?.trim();
  if (!secret) {
    throw new RazorpayConfigError();
  }
  return secret;
}

export function isRazorpayConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID?.trim() && process.env.RAZORPAY_KEY_SECRET?.trim());
}

function getClient(): Razorpay {
  return new Razorpay({
    key_id: getRazorpayKeyId(),
    key_secret: getRazorpayKeySecret(),
  });
}

export function rupeesToPaise(rupees: number): number {
  return rupees * 100;
}

function razorpayMessage(error: unknown): string {
  if (error instanceof RazorpayConfigError) {
    return error.message;
  }
  if (typeof error === "object" && error !== null && "error" in error) {
    const nested = (error as { error?: { description?: string } }).error;
    if (nested?.description) {
      return nested.description;
    }
  }
  if (error instanceof Error && error.message) {
    return "Could not reach Razorpay. Try again.";
  }
  return "Could not start payment. Try again.";
}

export async function createRazorpayPlan(input: {
  name: string;
  description: string | null;
  priceMonthly: number;
  currency: string;
}): Promise<{ id: string } | { error: string }> {
  try {
    const plan = await getClient().plans.create({
      period: "monthly",
      interval: 1,
      item: {
        name: input.name,
        amount: rupeesToPaise(input.priceMonthly),
        currency: input.currency,
        description: input.description ?? undefined,
      },
    });
    return { id: plan.id };
  } catch (error) {
    return { error: razorpayMessage(error) };
  }
}

export async function createRazorpayCustomer(input: {
  name: string;
  email: string;
}): Promise<{ id: string } | { error: string }> {
  try {
    const trimmedName = input.name.trim();
    const customer = await getClient().customers.create({
      email: input.email,
      name: trimmedName.length >= 3 ? trimmedName.slice(0, 50) : undefined,
      fail_existing: 0,
    });
    return { id: customer.id };
  } catch (error) {
    return { error: razorpayMessage(error) };
  }
}

export async function createRazorpaySubscription(input: {
  razorpayPlanId: string;
  notes: Record<string, string>;
}): Promise<{ id: string } | { error: string }> {
  try {
    const subscription = await getClient().subscriptions.create({
      plan_id: input.razorpayPlanId,
      total_count: 120,
      customer_notify: 1,
      notes: input.notes,
    });
    return { id: subscription.id };
  } catch (error) {
    return { error: razorpayMessage(error) };
  }
}

export async function createRazorpayOrder(input: {
  amountRupees: number;
  currency: string;
  receipt: string;
  notes: Record<string, string>;
}): Promise<{ id: string } | { error: string }> {
  try {
    const order = await getClient().orders.create({
      amount: rupeesToPaise(input.amountRupees),
      currency: input.currency,
      receipt: input.receipt.slice(0, 40),
      notes: input.notes,
    });
    return { id: order.id };
  } catch (error) {
    return { error: razorpayMessage(error) };
  }
}

function signaturesMatch(expected: string, received: string): boolean {
  const left = Buffer.from(expected);
  const right = Buffer.from(received);
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}

export function verifyRazorpayPaymentSignature(input: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  const expected = createHmac("sha256", getRazorpayKeySecret())
    .update(`${input.orderId}|${input.paymentId}`)
    .digest("hex");
  return signaturesMatch(expected, input.signature);
}

export function verifyRazorpaySubscriptionSignature(input: {
  subscriptionId: string;
  paymentId: string;
  signature: string;
}): boolean {
  const expected = createHmac("sha256", getRazorpayKeySecret())
    .update(`${input.paymentId}|${input.subscriptionId}`)
    .digest("hex");
  return signaturesMatch(expected, input.signature);
}

export function verifyRazorpayWebhookSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return false;
  }
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return signaturesMatch(expected, signature);
}
