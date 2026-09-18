"use client";

import type { RazorpayCheckoutSession } from "@/modules/billing/types";

export interface RazorpayCheckoutResult {
  razorpay_payment_id: string;
  razorpay_order_id?: string;
  razorpay_subscription_id?: string;
  razorpay_signature: string;
}

interface RazorpayInstance {
  open: () => void;
  on: (event: string, handler: (response: { error?: { description?: string } }) => void) => void;
}

interface RazorpayConstructor {
  new (options: Record<string, unknown>): RazorpayInstance;
}

function getRazorpayConstructor(): RazorpayConstructor | null {
  if (typeof window === "undefined") {
    return null;
  }
  return (window as unknown as { Razorpay?: RazorpayConstructor }).Razorpay ?? null;
}

function loadCheckoutScript(): Promise<RazorpayConstructor> {
  const existing = getRazorpayConstructor();
  if (existing) {
    return Promise.resolve(existing);
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => {
      const ctor = getRazorpayConstructor();
      if (!ctor) {
        reject(new Error("Razorpay failed to load."));
        return;
      }
      resolve(ctor);
    };
    script.onerror = () => reject(new Error("Could not load Razorpay Checkout."));
    document.body.appendChild(script);
  });
}

export async function openRazorpayCheckout(
  session: RazorpayCheckoutSession,
): Promise<RazorpayCheckoutResult | null> {
  const Razorpay = await loadCheckoutScript();

  return new Promise((resolve, reject) => {
    const checkout = new Razorpay({
      key: session.keyId,
      name: session.name,
      description: session.description,
      currency: session.currency,
      ...(session.orderId ? { amount: session.amountPaise, order_id: session.orderId } : {}),
      ...(session.subscriptionId ? { subscription_id: session.subscriptionId } : {}),
      prefill: {
        email: session.prefillEmail,
        name: session.prefillName ?? undefined,
      },
      theme: { color: "#111827" },
      handler: (response: RazorpayCheckoutResult) => {
        resolve(response);
      },
      modal: {
        ondismiss: () => resolve(null),
      },
    });

    checkout.on("payment.failed", (response) => {
      reject(new Error(response.error?.description ?? "Payment failed."));
    });

    checkout.open();
  });
}
