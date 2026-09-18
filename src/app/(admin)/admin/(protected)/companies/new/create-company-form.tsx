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
  const [isPending, startTransition] = useTransition();

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
      <div className="flex w-full max-w-sm flex-col gap-3 rounded-lg border p-4">
        <p className="text-sm font-medium">Company created</p>
        <p className="text-sm text-muted-foreground">
          Setup link for the new admin (dev mode — no email was sent):
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
    <form action={handleSubmit} className="flex w-full max-w-sm flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Company name</Label>
        <Input id="name" name="name" required maxLength={200} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="slug">Slug</Label>
        <Input id="slug" name="slug" placeholder="acme" required pattern="[a-z0-9\-]+" />
        <p className="text-xs text-muted-foreground">
          Lowercase letters, numbers, and hyphens only. Used in the login URL.
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="adminEmail">Admin email</Label>
        <Input id="adminEmail" name="adminEmail" type="email" required />
        <p className="text-xs text-muted-foreground">
          They&apos;ll get a setup link to create their password and sign in.
        </p>
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
        <p className="text-xs text-muted-foreground">
          Assigns the asset cap immediately. You can change this later from the company row.
        </p>
      </div>
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
        {isPending ? "Creating..." : "Create company"}
      </Button>
    </form>
  );
}
