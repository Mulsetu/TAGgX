"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { continueSignupAction, requestPasswordResetAction } from "@/modules/users/actions";
import type { AccountSignupState, ForgotPasswordState } from "@/modules/users/types";

const initialState: AccountSignupState = { error: null };
const initialReset: ForgotPasswordState = { submitted: false, error: null };

export function ContinueSignupForm({ planId }: { planId?: string }) {
  const router = useRouter();
  const [state, setState] = useState<AccountSignupState>(initialState);
  const [isPending, startTransition] = useTransition();
  const [resetOpen, setResetOpen] = useState(false);
  const [resetState, setResetState] = useState<ForgotPasswordState>(initialReset);
  const [isResetting, startReset] = useTransition();

  // After the reset email's link sets a new password, bring them back here.
  const returnPath = planId ? `/signup/continue?plan=${planId}` : "/signup/continue";

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await continueSignupAction(initialState, formData);
      if (result.redirectPath) {
        router.push(result.redirectPath);
        router.refresh();
        return;
      }
      if (result.checkEmail) {
        router.push("/signup/check-email");
        return;
      }
      setState(result);
    });
  }

  function handleReset(formData: FormData) {
    startReset(async () => {
      setResetState(await requestPasswordResetAction(returnPath, initialReset, formData));
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <form action={handleSubmit} className="flex flex-col gap-4">
        {planId ? <input type="hidden" name="planId" value={planId} /> : null}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Password</Label>
          <PasswordInput id="password" name="password" autoComplete="current-password" required />
        </div>
        {state.error ? (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        ) : null}
        <Button type="submit" disabled={isPending}>
          {isPending ? "Checking..." : "Continue"}
        </Button>
      </form>

      <div className="flex flex-col gap-3 border-t border-[#005068]/10 pt-4">
        {!resetOpen ? (
          <button
            type="button"
            className="self-start text-sm font-medium text-[#005068] underline-offset-4 hover:underline"
            onClick={() => setResetOpen(true)}
          >
            Forgot your password?
          </button>
        ) : resetState.submitted ? (
          <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            If that email has an account, a reset link is on its way. After you set a new password you&apos;ll come
            back here to continue.
          </p>
        ) : (
          <form action={handleReset} className="flex flex-col gap-2">
            <Label htmlFor="reset-email">Email for the reset link</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input id="reset-email" name="email" type="email" required autoComplete="email" className="flex-1" />
              <Button type="submit" variant="outline" disabled={isResetting}>
                {isResetting ? "Sending..." : "Send reset link"}
              </Button>
            </div>
            {resetState.error ? (
              <p role="alert" className="text-sm text-destructive">
                {resetState.error}
              </p>
            ) : null}
          </form>
        )}
      </div>
    </div>
  );
}
