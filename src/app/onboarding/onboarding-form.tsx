"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, CreditCard, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { openRazorpayCheckout, type RazorpayCheckoutResult } from "@/components/billing/open-razorpay-checkout";
import { formatInr } from "@/lib/money";
import { cn } from "@/lib/utils";
import {
  abandonSignupCheckoutAction,
  confirmSignupPaymentAction,
  createWorkspaceForCurrentUserAction,
} from "@/modules/billing/actions";
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
  const [consent, setConsent] = useState(false);
  const [stage, setStage] = useState<"idle" | "creating" | "paying" | "confirming">("idle");

  const plan = useMemo(() => plans.find((item) => item.id === planId) ?? plans[0], [plans, planId]);
  const paidPlan = plan ? plan.priceMonthly > 0 : false;

  function handleSubmit(formData: FormData) {
    formData.set("planId", planId);
    if (consent) {
      formData.set("autopayConsent", "on");
    }
    setState(initialState);
    startTransition(async () => {
      setStage("creating");
      const result = await createWorkspaceForCurrentUserAction(initialState, formData);
      if (result.checkout) {
        setStage("paying");
        let payment: RazorpayCheckoutResult | null = null;
        let failure = "Payment was cancelled.";
        try {
          payment = await openRazorpayCheckout(result.checkout);
        } catch (error) {
          failure = error instanceof Error ? error.message : "Payment failed.";
        }

        if (!payment) {
          // Nothing paid: drop the unpaid workspace so the plan is only
          // purchased — and the company only created — once payment succeeds.
          const abandoned = await abandonSignupCheckoutAction();
          if (abandoned.discarded) {
            setStage("idle");
            setState({ error: `${failure} Your card was not charged and the workspace was not created — try again when you're ready.` });
            return;
          }
          router.push(abandoned.redirectPath ?? result.redirectPath ?? "/dashboard");
          return;
        }

        setStage("confirming");
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
      }

      setStage("idle");
      if (result.redirectPath) {
        router.push(result.redirectPath);
        return;
      }
      setState(result);
    });
  }

  const busyLabel =
    stage === "paying" ? "Waiting for card payment..." : stage === "confirming" ? "Activating your workspace..." : "Setting up...";

  return (
    <form action={handleSubmit} className="grid gap-8 md:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="flex flex-col gap-6">
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-3 text-sm font-semibold">1. Choose your plan</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {plans.map((item) => {
              const selected = item.id === planId;
              return (
                <label
                  key={item.id}
                  className={cn(
                    "flex cursor-pointer flex-col gap-1.5 rounded-xl border p-4 transition-colors",
                    selected ? "border-[#005068] ring-2 ring-[#005068]/20" : "border-[#005068]/15 hover:border-[#005068]/40",
                  )}
                >
                  <input
                    type="radio"
                    name="planChoice"
                    value={item.id}
                    checked={selected}
                    onChange={() => setPlanId(item.id)}
                    className="sr-only"
                  />
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{item.name}</span>
                    {selected ? <Check className="size-4 text-[#005068]" aria-hidden /> : null}
                  </span>
                  <span className="text-xl font-semibold">
                    {formatInr(item.priceMonthly)}
                    <span className="text-sm font-normal text-[#003848]/55"> / month</span>
                  </span>
                  <span className="text-xs text-[#003848]/65">Up to {item.assetLimit.toLocaleString("en-IN")} assets</span>
                  {item.description ? <span className="text-xs text-[#003848]/55">{item.description}</span> : null}
                </label>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-4">
          <legend className="mb-3 text-sm font-semibold">2. Name your workspace</legend>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Company name</Label>
            <Input
              id="name"
              name="name"
              required
              maxLength={200}
              autoComplete="organization"
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
            <Label htmlFor="slug">Workspace URL</Label>
            <div className="flex items-center rounded-md border border-input focus-within:ring-2 focus-within:ring-ring">
              <span className="pl-3 font-mono text-sm text-[#003848]/50">/</span>
              <Input
                id="slug"
                name="slug"
                required
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                minLength={2}
                maxLength={63}
                value={slug}
                className="border-0 pl-0.5 font-mono focus-visible:ring-0"
                onChange={(event) => {
                  setSlugTouched(true);
                  setSlug(event.target.value.toLowerCase());
                }}
              />
              <span className="pr-3 font-mono text-sm text-[#003848]/50">/login</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Your team signs in here. Lowercase letters, numbers and hyphens. This can&apos;t be changed later.
            </p>
          </div>
        </fieldset>
      </div>

      <aside className="flex h-fit flex-col gap-4 rounded-xl border border-[#005068]/15 bg-[#F2F7F8] p-5 md:sticky md:top-6">
        <p className="text-sm font-semibold">{paidPlan ? "3. Pay by card" : "3. Start"}</p>
        {plan ? (
          <dl className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-[#003848]/65">{plan.name} plan</dt>
              <dd className="font-medium">{formatInr(plan.priceMonthly)} / month</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-[#003848]/65">Assets included</dt>
              <dd className="font-medium">{plan.assetLimit.toLocaleString("en-IN")}</dd>
            </div>
            <div className="mt-1 flex justify-between gap-3 border-t border-[#005068]/10 pt-3 text-base">
              <dt className="font-semibold">Due today</dt>
              <dd className="font-semibold">{formatInr(paidPlan ? plan.priceMonthly : 0)}</dd>
            </div>
          </dl>
        ) : null}

        {paidPlan && plan ? (
          <>
            <ul className="flex flex-col gap-1.5 text-xs text-[#003848]/70">
              <li className="flex gap-2">
                <CreditCard className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                Charged to your card today, then automatically every month.
              </li>
              <li className="flex gap-2">
                <Check className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                Cancel anytime from Settings → Billing; you keep access until the paid month ends.
              </li>
              <li className="flex gap-2">
                <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                Card details are entered on Razorpay&apos;s secure checkout and never stored by TagX.
              </li>
            </ul>
            <label className="flex items-start gap-2 rounded-lg border border-[#005068]/15 bg-white p-3 text-xs leading-5">
              <input
                type="checkbox"
                className="mt-0.5 size-4 shrink-0 rounded border-slate-300"
                checked={consent}
                onChange={(event) => setConsent(event.target.checked)}
                required
              />
              <span>
                I authorise TagX to charge {formatInr(plan.priceMonthly)} to my card every month until I cancel.
              </span>
            </label>
          </>
        ) : null}

        {state.error ? (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        ) : null}

        <Button type="submit" disabled={isPending || (paidPlan && !consent)} className="w-full">
          {isPending
            ? busyLabel
            : paidPlan && plan
              ? `Add card & pay ${formatInr(plan.priceMonthly)}`
              : "Create workspace"}
        </Button>
        {paidPlan ? (
          <p className="text-center text-[11px] text-[#003848]/55">
            Your workspace is created only after the card payment succeeds.
          </p>
        ) : null}
      </aside>
    </form>
  );
}
