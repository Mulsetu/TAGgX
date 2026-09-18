"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { openRazorpayCheckout } from "@/components/billing/open-razorpay-checkout";
import { formatInr } from "@/lib/money";
import {
  confirmExtraAssetPaymentAction,
  confirmSignupPaymentAction,
  requestExtraAssetsAction,
  startPlanPaymentAction,
} from "@/modules/billing/actions";
import type { BillingOrder, CompanyAssetQuota, ExtraAssetOrderState } from "@/modules/billing/types";

const initialState: ExtraAssetOrderState = { error: null };

export function BillingPanel({
  quota,
  orders,
  canEdit,
}: {
  quota: CompanyAssetQuota;
  orders: BillingOrder[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [state, setState] = useState<ExtraAssetOrderState>(initialState);
  const [isPending, startTransition] = useTransition();
  const [isPayingPlan, startPlanPay] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await requestExtraAssetsAction(initialState, formData);
      if (result.checkout) {
        try {
          const payment = await openRazorpayCheckout(result.checkout);
          if (!payment) {
            setState({ error: "Payment was cancelled." });
            return;
          }

          const confirmData = new FormData();
          confirmData.set("razorpayPaymentId", payment.razorpay_payment_id);
          confirmData.set("razorpaySignature", payment.razorpay_signature);
          confirmData.set(
            "razorpayOrderId",
            payment.razorpay_order_id ?? result.checkout.orderId ?? "",
          );
          if (result.checkout.billingOrderId) {
            confirmData.set("billingOrderId", result.checkout.billingOrderId);
          }

          const confirmed = await confirmExtraAssetPaymentAction({ error: null }, confirmData);
          if (confirmed.error) {
            setState({ error: confirmed.error });
            return;
          }
          setState({ error: null, success: true });
          router.refresh();
          return;
        } catch (error) {
          setState({ error: error instanceof Error ? error.message : "Payment failed." });
          return;
        }
      }

      setState(result);
      if (result.success) {
        router.refresh();
      }
    });
  }

  function handlePayPlan() {
    startPlanPay(async () => {
      const result = await startPlanPaymentAction();
      if (result.error || !result.checkout) {
        setState({ error: result.error ?? "Could not start payment." });
        return;
      }

      try {
        const payment = await openRazorpayCheckout(result.checkout);
        if (!payment) {
          setState({ error: "Payment was cancelled." });
          return;
        }

        const confirmData = new FormData();
        confirmData.set("razorpayPaymentId", payment.razorpay_payment_id);
        confirmData.set("razorpaySignature", payment.razorpay_signature);
        confirmData.set(
          "razorpaySubscriptionId",
          payment.razorpay_subscription_id ?? result.checkout.subscriptionId ?? "",
        );
        if (result.checkout.confirmToken) {
          confirmData.set("confirmToken", result.checkout.confirmToken);
        }

        const confirmed = await confirmSignupPaymentAction({ error: null }, confirmData);
        if (confirmed.error) {
          setState({ error: confirmed.error });
          return;
        }
        setState({ error: null, success: true });
        router.refresh();
      } catch (error) {
        setState({ error: error instanceof Error ? error.message : "Payment failed." });
      }
    });
  }

  const plan = quota.plan;
  const needsPlanPayment =
    quota.subscriptionStatus === "pending_payment" ||
    quota.subscriptionStatus === "past_due" ||
    quota.subscriptionStatus === "halted";

  return (
    <section className="flex max-w-lg flex-col gap-4 rounded-lg border p-4">
      <div>
        <h2 className="text-base font-semibold">Plan &amp; assets</h2>
        <p className="text-sm text-muted-foreground">
          Monthly plans and extra asset packs are paid through Razorpay.
        </p>
      </div>

      {plan ? (
        <div className="flex flex-col gap-1 text-sm">
          <p>
            <span className="font-medium">{plan.name}</span>{" "}
            <span className="text-muted-foreground">
              {formatInr(plan.priceMonthly)} / month
            </span>
          </p>
          <p className="text-muted-foreground">
            {quota.assetCount.toLocaleString("en-IN")} of{" "}
            {(quota.effectiveLimit ?? 0).toLocaleString("en-IN")} assets used
            {quota.extraAssets > 0
              ? ` (includes +${quota.extraAssets.toLocaleString("en-IN")} extra)`
              : ""}
            .
          </p>
          {quota.subscriptionStatus === "pending_payment" ? (
            <p className="text-sm text-amber-700">Payment pending — complete Razorpay checkout to add assets.</p>
          ) : null}
          {quota.subscriptionStatus === "past_due" || quota.subscriptionStatus === "halted" ? (
            <p className="text-sm text-destructive">Subscription payment failed. Pay again to restore access.</p>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No plan is assigned yet, so assets are not capped. Contact TagX if you expected a
          paid plan.
        </p>
      )}

      {plan && canEdit && needsPlanPayment ? (
        <Button type="button" onClick={handlePayPlan} disabled={isPayingPlan} className="self-start">
          {isPayingPlan ? "Opening Razorpay..." : `Pay ${formatInr(plan.priceMonthly)} with Razorpay`}
        </Button>
      ) : null}

      {plan && canEdit && quota.subscriptionStatus === "active" ? (
        <form action={handleSubmit} className="flex flex-col gap-3 border-t pt-4">
          <p className="text-sm font-medium">Need more than {plan.assetLimit.toLocaleString("en-IN")} assets?</p>
          <p className="text-xs text-muted-foreground">
            Extra pack: {plan.extraAssetQuantity.toLocaleString("en-IN")} assets for{" "}
            {formatInr(plan.extraAssetPrice)}. Paid immediately through Razorpay.
          </p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="packs">Number of packs</Label>
            <Input id="packs" name="packs" type="number" min={1} max={50} defaultValue={1} required />
          </div>
          {state.error ? (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          ) : null}
          {state.success ? (
            <p className="text-sm text-emerald-600">Payment received. Extra assets have been added.</p>
          ) : null}
          <Button type="submit" variant="outline" className="self-start" disabled={isPending}>
            {isPending ? "Opening Razorpay..." : "Buy extra assets"}
          </Button>
        </form>
      ) : null}

      {state.error && needsPlanPayment ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      {orders.length > 0 ? (
        <div className="flex flex-col gap-2 border-t pt-4">
          <p className="text-sm font-medium">Recent extra-asset orders</p>
          <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
            {orders.map((order) => (
              <li key={order.id}>
                +{order.assetQuantity.toLocaleString("en-IN")} assets · {formatInr(order.amount)} ·{" "}
                {order.status}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
