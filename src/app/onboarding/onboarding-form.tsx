"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { openRazorpayCheckout } from "@/components/billing/open-razorpay-checkout";
import { formatInr } from "@/lib/money";
import { confirmSignupPaymentAction, createWorkspaceForCurrentUserAction } from "@/modules/billing/actions";
import type { BillingPlan, CreateWorkspaceState } from "@/modules/billing/types";

const initialState: CreateWorkspaceState = { error: null };

function slugFromName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
}

export function OnboardingForm({
  plans,
  selectedPlanId,
}: {
  plans: BillingPlan[];
  selectedPlanId: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<CreateWorkspaceState>(initialState);
  const [isPending, startTransition] = useTransition();
  const [planId, setPlanId] = useState(selectedPlanId);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);

  const plan = useMemo(() => plans.find((item) => item.id === planId) ?? plans[0], [plans, planId]);

  function handleSubmit(formData: FormData) {
    formData.set("planId", planId);
    startTransition(async () => {
      const result = await createWorkspaceForCurrentUserAction(initialState, formData);
      if (result.checkout) {
        try {
          const payment = await openRazorpayCheckout(result.checkout);
          if (!payment) {
            setState({
              error: "Payment was cancelled. You can finish paying from Settings.",
              redirectPath: result.redirectPath,
            });
            if (result.redirectPath) {
              router.push(result.redirectPath);
            }
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
          router.push(confirmed.redirectPath ?? result.redirectPath ?? "/dashboard");
          return;
        } catch (error) {
          setState({
            error: error instanceof Error ? error.message : "Payment failed.",
            redirectPath: result.redirectPath,
          });
          return;
        }
      }

      if (result.redirectPath) {
        router.push(result.redirectPath);
        return;
      }
      setState(result);
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="planId">Plan</Label>
        <NativeSelect id="planId" value={planId} onChange={(event) => setPlanId(event.target.value)}>
          {plans.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} — {formatInr(item.priceMonthly)}/mo · {item.assetLimit.toLocaleString("en-IN")}{" "}
              assets
            </option>
          ))}
        </NativeSelect>
        {plan ? (
          <p className="text-xs text-muted-foreground">
            {plan.priceMonthly > 0
              ? `Paid plans are billed through Razorpay. Extra assets later: ${plan.extraAssetQuantity.toLocaleString("en-IN")} for ${formatInr(plan.extraAssetPrice)} per pack.`
              : "This plan does not require a payment record to start."}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Company name</Label>
        <Input
          id="name"
          name="name"
          required
          maxLength={200}
          value={name}
          onChange={(event) => {
            const next = event.target.value;
            setName(next);
            if (!slugTouched) {
              setSlug(slugFromName(next));
            }
          }}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="slug">Workspace slug</Label>
        <Input
          id="slug"
          name="slug"
          required
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          minLength={2}
          maxLength={63}
          value={slug}
          onChange={(event) => {
            setSlugTouched(true);
            setSlug(event.target.value.toLowerCase());
          }}
        />
        <p className="text-xs text-muted-foreground">
          Your team signs in at{" "}
          <span className="font-mono">/{slug || "your-company"}/login</span>. This can&apos;t be
          changed later.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="logo">Company logo (optional)</Label>
        <Input id="logo" name="logo" type="file" accept="image/*" />
      </div>

      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" disabled={isPending}>
        {isPending
          ? "Creating workspace..."
          : plan && plan.priceMonthly > 0
            ? `Continue to pay ${formatInr(plan.priceMonthly)}`
            : "Create workspace"}
      </Button>
    </form>
  );
}
