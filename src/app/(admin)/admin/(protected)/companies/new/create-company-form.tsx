"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { formatInr } from "@/lib/money";
import { createCompanyAction } from "@/modules/companies/actions";
import type { BillingPlan } from "@/modules/billing/types";
import type { CreateCompanyState } from "@/modules/companies/types";

const initialState: CreateCompanyState = { error: null };

export function CreateCompanyForm({ plans }: { plans: BillingPlan[] }) {
  const [state, setState] = useState<CreateCompanyState>(initialState);
  const [isDedicatedInfra, setIsDedicatedInfra] = useState(false);
  const [subscriptionType, setSubscriptionType] = useState("sales_assisted");
  const [isPending, startTransition] = useTransition();

  const skipPayment =
    subscriptionType === "demo" || subscriptionType === "complimentary" || subscriptionType === "trial";

  function handleSubmit(formData: FormData) {
    if (isDedicatedInfra) {
      formData.set("isDedicatedInfra", "on");
    }

    startTransition(async () => {
      const result = await createCompanyAction(initialState, formData);
      setState(result);
    });
  }

  if (state.inviteUrl) {
    return (
      <div className="flex w-full max-w-lg flex-col gap-3 rounded-lg border p-4">
        <p className="text-sm font-medium">Company created</p>
        <p className="text-sm text-muted-foreground">
          Setup link for the new Company Admin (dev mode — no email was sent):
        </p>
        <a
          href={state.inviteUrl}
          className="break-all rounded-md bg-muted px-2 py-1.5 text-xs hover:underline"
        >
          {state.inviteUrl}
        </a>
        <Button asChild variant="outline" size="sm">
          <a href="/admin">Back to companies</a>
        </Button>
      </div>
    );
  }

  return (
    <form action={handleSubmit} className="flex w-full max-w-lg flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Company name</Label>
        <Input id="name" name="name" required maxLength={200} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="slug">Slug</Label>
        <Input id="slug" name="slug" placeholder="acme" required pattern="[a-z0-9\-]+" />
        <p className="text-xs text-muted-foreground">
          Used in the company login URL. The customer sets their own password from the invite.
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="adminEmail">Company Admin email</Label>
        <Input id="adminEmail" name="adminEmail" type="email" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="adminName">Company Admin name (optional)</Label>
        <Input id="adminName" name="adminName" maxLength={200} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="planId">Plan</Label>
        <NativeSelect id="planId" name="planId" defaultValue={plans[0]?.id ?? ""}>
          <option value="">No plan (unlimited assets)</option>
          {plans.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {plan.name} — {formatInr(plan.priceMonthly)}/mo · {plan.assetLimit.toLocaleString("en-IN")}{" "}
              assets
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="grid grid-cols-1 gap-3 @sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="subscriptionType">Subscription type</Label>
          <NativeSelect
            id="subscriptionType"
            name="subscriptionType"
            value={subscriptionType}
            onChange={(event) => setSubscriptionType(event.target.value)}
          >
            <option value="sales_assisted">Sales-assisted</option>
            <option value="self_service">Self-service</option>
            <option value="enterprise">Enterprise</option>
            <option value="demo">Demo</option>
            <option value="trial">Trial</option>
            <option value="complimentary">Complimentary</option>
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="billingCycle">Billing cycle</Label>
          <NativeSelect id="billingCycle" name="billingCycle" defaultValue="monthly">
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
            <option value="custom">Custom</option>
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="startsAt">Start date</Label>
          <Input id="startsAt" name="startsAt" type="date" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="endsAt">End date</Label>
          <Input id="endsAt" name="endsAt" type="date" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="subscriptionStatus">Subscription status</Label>
          <NativeSelect id="subscriptionStatus" name="subscriptionStatus" defaultValue="">
            <option value="">Automatic</option>
            <option value="trial">Trial</option>
            <option value="pending_payment">Pending payment</option>
            <option value="active">Active</option>
          </NativeSelect>
        </div>
      </div>
      {skipPayment ? (
        <p className="text-xs text-muted-foreground">
          Demo, trial, and complimentary workspaces do not create payment records.
        </p>
      ) : (
        <div className="flex flex-col gap-3 rounded-lg border p-4">
          <p className="text-sm font-medium">Record payment (optional)</p>
          <p className="text-xs text-muted-foreground">
            Use this for RTGS, NEFT, UPI, cash, cheque, or other offline payments. Leave blank to
            invite the customer with a pending subscription.
          </p>
          <div className="grid grid-cols-1 gap-3 @sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="paymentMethod">Method</Label>
              <NativeSelect id="paymentMethod" name="paymentMethod" defaultValue="">
                <option value="">None</option>
                <option value="razorpay">Razorpay</option>
                <option value="upi">UPI</option>
                <option value="bank_transfer">Bank transfer</option>
                <option value="neft">NEFT</option>
                <option value="rtgs">RTGS</option>
                <option value="cash">Cash</option>
                <option value="cheque">Cheque</option>
                <option value="other">Other</option>
              </NativeSelect>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="paymentAmount">Amount (₹)</Label>
              <Input id="paymentAmount" name="paymentAmount" type="number" min={0} step={1} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="paymentStatus">Payment status</Label>
              <NativeSelect id="paymentStatus" name="paymentStatus" defaultValue="paid">
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="partially_paid">Partially paid</option>
                <option value="failed">Failed</option>
                <option value="cancelled">Cancelled</option>
                <option value="refunded">Refunded</option>
                <option value="waived">Waived</option>
              </NativeSelect>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="paymentDate">Payment date</Label>
              <Input id="paymentDate" name="paymentDate" type="date" />
            </div>
            <div className="flex flex-col gap-1.5 @sm:col-span-2">
              <Label htmlFor="paymentReference">Reference number</Label>
              <Input id="paymentReference" name="paymentReference" maxLength={120} />
            </div>
            <div className="flex flex-col gap-1.5 @sm:col-span-2">
              <Label htmlFor="paymentNotes">Notes</Label>
              <Input id="paymentNotes" name="paymentNotes" maxLength={1000} />
            </div>
          </div>
        </div>
      )}
      <div className="flex items-center gap-2">
        <Checkbox
          id="isDedicatedInfra"
          checked={isDedicatedInfra}
          onCheckedChange={(checked) => setIsDedicatedInfra(checked === true)}
        />
        <Label htmlFor="isDedicatedInfra" className="font-normal">
          Needs dedicated infrastructure
        </Label>
      </div>
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={isPending}>
        {isPending ? "Creating..." : "Create company and send invite"}
      </Button>
    </form>
  );
}
