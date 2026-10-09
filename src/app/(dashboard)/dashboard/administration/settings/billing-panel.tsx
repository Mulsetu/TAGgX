"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, CalendarClock, Check, CreditCard, FileText, Package, Receipt } from "lucide-react";
import { LocalTime } from "@/components/layout/local-time";
import { openRazorpayCheckout } from "@/components/billing/open-razorpay-checkout";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatInr } from "@/lib/money";
import { cn } from "@/lib/utils";
import {
  cancelSubscriptionAction,
  confirmExtraAssetPaymentAction,
  confirmSignupPaymentAction,
  requestExtraAssetsAction,
  requestPlanChangeAction,
  resumeSubscriptionAction,
  startPlanPaymentAction,
} from "@/modules/billing/actions";
import type {
  BillingActionState,
  BillingOrder,
  BillingOverview,
  BillingPayment,
  CompanyAssetQuota,
  ExtraAssetOrderState,
  PaymentMethod,
  SubscriptionStatus,
} from "@/modules/billing/types";

const initialState: ExtraAssetOrderState = { error: null };
const initialAction: BillingActionState = { error: null };
const DAY = 86_400_000;

const METHOD_LABELS: Record<PaymentMethod, string> = {
  razorpay: "Razorpay",
  upi: "UPI",
  bank_transfer: "Bank transfer",
  neft: "NEFT",
  rtgs: "RTGS",
  cash: "Cash",
  cheque: "Cheque",
  other: "Other",
};

const STATUS_BADGE: Record<SubscriptionStatus, { label: string; className: string }> = {
  active: { label: "Active", className: "bg-emerald-50 text-emerald-700" },
  trial: { label: "Trial", className: "bg-sky-50 text-sky-700" },
  pending_payment: { label: "Payment due", className: "bg-amber-50 text-amber-800" },
  past_due: { label: "Payment failed", className: "bg-red-50 text-red-700" },
  halted: { label: "Payment failed", className: "bg-red-50 text-red-700" },
  canceled: { label: "Cancelled", className: "bg-slate-100 text-slate-600" },
  expired: { label: "Expired", className: "bg-slate-100 text-slate-600" },
  suspended: { label: "Suspended", className: "bg-red-50 text-red-700" },
  draft: { label: "Not started", className: "bg-slate-100 text-slate-600" },
};

function Card({ title, icon, children, className }: { title: string; icon: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5", className)}>
      <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}

function Meter({ value, max, tone = "primary" }: { value: number; max: number; tone?: "primary" | "amber" }) {
  const percent = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
      <div
        className={cn("h-full rounded-full", tone === "amber" ? "bg-amber-500" : "bg-primary")}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

function ChangePlanDialog({ overview, currentPlanId }: { overview: BillingOverview; currentPlanId: string | null }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string>("");
  const [state, setState] = useState<BillingActionState>(initialAction);
  const [isPending, startTransition] = useTransition();

  function submit(formData: FormData) {
    startTransition(async () => setState(await requestPlanChangeAction(initialAction, formData)));
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setState(initialAction);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">Change plan</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Change plan</DialogTitle>
          <DialogDescription>
            Pick a plan and send a request — the TagX team confirms pricing and switches you over, usually within one
            business day.
          </DialogDescription>
        </DialogHeader>
        {state.success ? (
          <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{state.success}</p>
        ) : (
          <form action={submit} className="flex flex-col gap-4">
            <div className="grid gap-3 @lg:grid-cols-3">
              {overview.plans.map((plan) => {
                const current = plan.id === currentPlanId;
                return (
                  <label
                    key={plan.id}
                    className={cn(
                      "flex cursor-pointer flex-col gap-2 rounded-xl border p-4 transition-colors",
                      selected === plan.id ? "border-primary ring-2 ring-primary/30" : "border-slate-200 hover:border-slate-300",
                      current && "cursor-default opacity-70",
                    )}
                  >
                    <input
                      type="radio"
                      name="planId"
                      value={plan.id}
                      disabled={current}
                      checked={selected === plan.id}
                      onChange={() => setSelected(plan.id)}
                      className="sr-only"
                    />
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-900">{plan.name}</span>
                      {current ? <Badge variant="secondary">Current</Badge> : null}
                    </span>
                    <span className="text-lg font-semibold text-slate-900">
                      {formatInr(plan.priceMonthly)}
                      <span className="text-sm font-normal text-slate-500"> / month</span>
                    </span>
                    <span className="flex items-center gap-1.5 text-sm text-slate-600">
                      <Check className="size-3.5 text-emerald-600" />
                      Up to {plan.assetLimit.toLocaleString("en-IN")} assets
                    </span>
                    {plan.description ? <span className="text-xs text-slate-500">{plan.description}</span> : null}
                  </label>
                );
              })}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="plan-note">Anything we should know? (optional)</Label>
              <Textarea id="plan-note" name="note" rows={2} maxLength={1000} placeholder="e.g. we're adding a second site next month" />
            </div>
            {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
            <Button type="submit" disabled={!selected || isPending} className="self-start">
              {isPending ? "Sending..." : "Request this plan"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function BillingPanel({
  quota,
  orders,
  payments,
  overview,
  canEdit,
  currentPlanId,
}: {
  quota: CompanyAssetQuota;
  orders: BillingOrder[];
  payments: BillingPayment[];
  overview: BillingOverview;
  canEdit: boolean;
  currentPlanId: string | null;
}) {
  const router = useRouter();
  const [state, setState] = useState<ExtraAssetOrderState>(initialState);
  const [actionState, setActionState] = useState<BillingActionState>(initialAction);
  const [isPending, startTransition] = useTransition();
  const [isPayingPlan, startPlanPay] = useTransition();
  const [isChanging, startChange] = useTransition();

  function handleExtraAssets(formData: FormData) {
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
          confirmData.set("razorpayOrderId", payment.razorpay_order_id ?? result.checkout.orderId ?? "");
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
      if (result.success) router.refresh();
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
        confirmData.set("razorpaySubscriptionId", payment.razorpay_subscription_id ?? result.checkout.subscriptionId ?? "");
        if (result.checkout.confirmToken) confirmData.set("confirmToken", result.checkout.confirmToken);
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

  function runChange(action: () => Promise<BillingActionState>) {
    startChange(async () => {
      const result = await action();
      setActionState(result);
      if (!result.error) router.refresh();
    });
  }

  const plan = quota.plan;
  const sub = overview.subscription;
  const needsPlanPayment =
    quota.subscriptionStatus === "pending_payment" || quota.subscriptionStatus === "past_due" || quota.subscriptionStatus === "halted";
  const periodEnd = sub?.periodEnd ? new Date(sub.periodEnd).getTime() : null;
  const periodStart = sub ? new Date(sub.startsAt).getTime() : null;
  const daysLeft = periodEnd ? Math.max(0, Math.ceil((periodEnd - Date.now()) / DAY)) : null;
  const periodDays = periodEnd && periodStart ? Math.max(1, Math.round((periodEnd - periodStart) / DAY)) : null;
  const cancelling = sub !== null && !sub.autoRenew;
  const badge = sub ? STATUS_BADGE[sub.status] : null;
  const isAdmin = overview.isCompanyAdmin;
  const lastMethod = payments.find((payment) => payment.paymentStatus === "paid")?.paymentMethod ?? null;

  return (
    <div className="flex max-w-5xl flex-col gap-4">
      {/* Current plan */}
      <section className="flex flex-col gap-5 rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Current plan</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-semibold text-slate-900">{plan?.name ?? "No plan"}</h2>
              {badge ? <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", badge.className)}>{badge.label}</span> : null}
              {cancelling ? <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800">Ends soon</span> : null}
            </div>
            {plan ? (
              <p className="text-sm text-slate-500">
                {formatInr(plan.priceMonthly)} / month
                {sub ? ` · billed ${sub.billingCycle === "yearly" ? "yearly" : sub.billingCycle === "monthly" ? "monthly" : "on a custom term"}` : ""}
              </p>
            ) : (
              <p className="text-sm text-slate-500">No plan is assigned yet, so assets are not capped.</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {plan && canEdit && needsPlanPayment ? (
              <Button type="button" onClick={handlePayPlan} disabled={isPayingPlan}>
                <CreditCard className="size-4" />
                {isPayingPlan ? "Opening Razorpay..." : `Pay ${formatInr(plan.priceMonthly)}`}
              </Button>
            ) : null}
            {isAdmin && overview.plans.length > 0 ? <ChangePlanDialog overview={overview} currentPlanId={currentPlanId} /> : null}
          </div>
        </div>

        {sub ? (
          <div className="grid gap-4 @2xl:grid-cols-3">
            <div className="flex flex-col gap-1">
              <p className="text-xs text-slate-500">Started</p>
              <p className="text-sm font-medium text-slate-900">
                <LocalTime iso={sub.startsAt} mode="date" />
              </p>
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-xs text-slate-500">{cancelling ? "Access ends" : sub.status === "trial" ? "Trial ends" : "Renews on"}</p>
              <p className="text-sm font-medium text-slate-900">
                {sub.periodEnd ? <LocalTime iso={sub.periodEnd} mode="date" /> : "No end date"}
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <p className="flex items-center gap-1 text-xs text-slate-500">
                <CalendarClock className="size-3" /> Time left in this period
              </p>
              {daysLeft !== null ? (
                <>
                  <p className={cn("text-sm font-semibold", daysLeft <= 7 ? "text-amber-700" : "text-slate-900")}>
                    {daysLeft} day{daysLeft === 1 ? "" : "s"}
                  </p>
                  {periodDays ? <Meter value={periodDays - daysLeft} max={periodDays} tone={daysLeft <= 7 ? "amber" : "primary"} /> : null}
                </>
              ) : (
                <p className="text-sm font-medium text-slate-900">—</p>
              )}
            </div>
          </div>
        ) : null}

        {plan ? (
          <div className="flex flex-col gap-1.5 border-t border-slate-100 pt-4">
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-slate-600">Assets used</span>
              <span className="font-medium text-slate-900">
                {quota.assetCount.toLocaleString("en-IN")} / {(quota.effectiveLimit ?? 0).toLocaleString("en-IN")}
                {quota.extraAssets > 0 ? <span className="font-normal text-slate-500"> (incl. +{quota.extraAssets.toLocaleString("en-IN")} extra)</span> : null}
              </span>
            </div>
            <Meter value={quota.assetCount} max={quota.effectiveLimit ?? 0} tone={quota.atLimit ? "amber" : "primary"} />
          </div>
        ) : null}

        {quota.subscriptionStatus === "pending_payment" ? (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">Payment is due — pay now to unlock adding assets.</p>
        ) : null}
        {quota.subscriptionStatus === "past_due" || quota.subscriptionStatus === "halted" ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">The last payment failed. Pay again to restore full access.</p>
        ) : null}
        {state.error ? <p role="alert" className="text-sm text-destructive">{state.error}</p> : null}
      </section>

      <div className="grid gap-4 @3xl:grid-cols-2">
        {/* Billing information */}
        <Card title="Billing information" icon={<Building2 className="size-4 text-slate-500" />}>
          <dl className="grid grid-cols-[7rem_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
            <dt className="text-slate-500">Company</dt>
            <dd className="font-medium text-slate-900">{overview.billingContact.companyName || "—"}</dd>
            <dt className="text-slate-500">Billing email</dt>
            <dd className="truncate text-slate-900">{overview.billingContact.email ?? "Not set"}</dd>
            <dt className="text-slate-500">Phone</dt>
            <dd className="text-slate-900">{overview.billingContact.phone ?? "Not set"}</dd>
            <dt className="text-slate-500">Address</dt>
            <dd className="text-slate-900">{overview.billingContact.address ?? "Not set"}</dd>
          </dl>
          <Link href="/dashboard/administration/settings/branding" className="mt-auto text-sm font-medium text-[hsl(var(--brand-primary))] hover:underline">
            Edit in Branding →
          </Link>
        </Card>

        {/* Payment method */}
        <Card title="Payment method" icon={<CreditCard className="size-4 text-slate-500" />}>
          {sub?.onlineBilling ? (
            <p className="text-sm text-slate-600">
              Paid online through <span className="font-medium text-slate-900">Razorpay</span> — card, UPI or net banking.
              Your card details are stored by Razorpay, never by TagX. To change your card, pay with the new one at the next
              payment prompt.
            </p>
          ) : (
            <p className="text-sm text-slate-600">
              Billed offline by the TagX team
              {lastMethod ? (
                <>
                  {" "}— last paid by <span className="font-medium text-slate-900">{METHOD_LABELS[lastMethod]}</span>
                </>
              ) : null}
              . Bank transfer, UPI, NEFT/RTGS and cheque are accepted; contact TagX to change how you pay.
            </p>
          )}
          {plan && canEdit && quota.subscriptionStatus === "active" ? (
            <form action={handleExtraAssets} className="mt-auto flex flex-col gap-2 border-t border-slate-100 pt-3">
              <p className="flex items-center gap-1.5 text-sm font-medium text-slate-900">
                <Package className="size-4 text-slate-500" /> Need more assets?
              </p>
              <p className="text-xs text-slate-500">
                Each pack adds {plan.extraAssetQuantity.toLocaleString("en-IN")} assets for {formatInr(plan.extraAssetPrice)}, paid now via Razorpay.
              </p>
              <div className="flex items-end gap-2">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="packs" className="text-xs">Packs</Label>
                  <Input id="packs" name="packs" type="number" min={1} max={50} defaultValue={1} required className="w-20" />
                </div>
                <Button type="submit" variant="outline" disabled={isPending}>
                  {isPending ? "Opening Razorpay..." : "Buy extra assets"}
                </Button>
              </div>
              {state.success ? <p className="text-sm text-emerald-600">Payment received — extra assets added.</p> : null}
            </form>
          ) : null}
        </Card>
      </div>

      {/* Transactions */}
      <Card title="Invoices & payments" icon={<Receipt className="size-4 text-slate-500" />}>
        {payments.length === 0 && orders.length === 0 ? (
          <p className="text-sm text-slate-500">No payments yet.</p>
        ) : (
          <div className="-mx-5 overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <thead>
                <tr className="border-y border-slate-100 text-left text-xs text-slate-400">
                  <th className="px-5 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Description</th>
                  <th className="px-3 py-2 font-medium">Method</th>
                  <th className="px-3 py-2 text-right font-medium">Amount</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-5 py-2" />
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id} className="border-b border-slate-100 last:border-0">
                    <td className="whitespace-nowrap px-5 py-3 text-slate-600">
                      <LocalTime iso={payment.paymentDate} mode="date" />
                    </td>
                    <td className="px-3 py-3 text-slate-900">{plan?.name ?? "Plan"} subscription</td>
                    <td className="px-3 py-3 text-slate-600">{METHOD_LABELS[payment.paymentMethod]}</td>
                    <td className="px-3 py-3 text-right font-medium text-slate-900">{formatInr(payment.amount)}</td>
                    <td className="px-3 py-3">
                      <span className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                        payment.paymentStatus === "paid" ? "bg-emerald-50 text-emerald-700" : payment.paymentStatus === "failed" ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-600",
                      )}>
                        {payment.paymentStatus.replaceAll("_", " ")}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        href={`/dashboard/administration/invoices/${payment.id}`}
                        className="inline-flex items-center gap-1 text-sm font-medium text-[hsl(var(--brand-primary))] hover:underline"
                      >
                        <FileText className="size-3.5" /> Invoice
                      </Link>
                    </td>
                  </tr>
                ))}
                {orders.map((order) => (
                  <tr key={order.id} className="border-b border-slate-100 last:border-0">
                    <td className="whitespace-nowrap px-5 py-3 text-slate-600">
                      <LocalTime iso={order.createdAt} mode="date" />
                    </td>
                    <td className="px-3 py-3 text-slate-900">+{order.assetQuantity.toLocaleString("en-IN")} extra assets</td>
                    <td className="px-3 py-3 text-slate-600">Razorpay</td>
                    <td className="px-3 py-3 text-right font-medium text-slate-900">{formatInr(order.amount)}</td>
                    <td className="px-3 py-3">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium capitalize text-slate-600">
                        {order.status === "fulfilled" ? "paid" : order.status}
                      </span>
                    </td>
                    <td className="px-5 py-3" />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Cancel */}
      {isAdmin && sub && plan && sub.status !== "canceled" && sub.status !== "expired" ? (
        <section className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 @2xl:flex-row @2xl:items-center @2xl:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">{cancelling ? "Your plan is set to end" : "Cancel plan"}</h2>
            <p className="text-sm text-slate-500">
              {cancelling ? (
                <>
                  You keep full access until{" "}
                  {sub.periodEnd ? <LocalTime iso={sub.periodEnd} mode="date" className="font-medium text-slate-700" /> : "the end of the billing period"}
                  . After that the workspace becomes read-only.
                </>
              ) : (
                "If you cancel, you'll keep full access to your plan features until the end of your billing period."
              )}
            </p>
            {actionState.error ? <p className="mt-1 text-sm text-destructive">{actionState.error}</p> : null}
            {actionState.success ? <p className="mt-1 text-sm text-emerald-700">{actionState.success}</p> : null}
          </div>
          {cancelling ? (
            !sub.onlineBilling ? (
              <Button type="button" variant="outline" disabled={isChanging} onClick={() => runChange(resumeSubscriptionAction)}>
                {isChanging ? "Saving..." : "Keep my plan"}
              </Button>
            ) : null
          ) : (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="outline" className="text-destructive hover:text-destructive">
                  Cancel plan
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancel your {plan.name} plan?</AlertDialogTitle>
                  <AlertDialogDescription>
                    If you cancel, you&apos;ll keep full access to your plan features until the end of your billing period
                    {sub.periodEnd ? (
                      <>
                        {" "}(<LocalTime iso={sub.periodEnd} mode="date" />)
                      </>
                    ) : null}
                    . After that, your data stays safe but the workspace becomes read-only.
                    {sub.onlineBilling ? " You won't be charged again." : ""}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep plan</AlertDialogCancel>
                  <AlertDialogAction
                    disabled={isChanging}
                    onClick={() => runChange(cancelSubscriptionAction)}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Cancel plan
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </section>
      ) : null}
    </div>
  );
}
