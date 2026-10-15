"use client";

import { useFormState } from "react-dom";
import { PendingSubmitButton } from "@/components/auth/pending-submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resendSignupVerificationAction } from "@/modules/users/actions";
import type { ResendVerificationState } from "@/modules/users/types";

const initialState: ResendVerificationState = { error: null };

/** Mails a fresh verification link when the first one expired or never arrived. */
export function ResendVerificationForm({ planId }: { planId?: string }) {
  const [state, formAction] = useFormState(resendSignupVerificationAction, initialState);

  if (state.submitted) {
    return (
      <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
        If that email has an account waiting to be verified, a new link is on its way. It can take a minute — check
        spam too.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-2">
      {planId ? <input type="hidden" name="planId" value={planId} /> : null}
      <Label htmlFor="resend-email">Email you signed up with</Label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input id="resend-email" name="email" type="email" autoComplete="email" required className="flex-1" />
        <PendingSubmitButton idle="Send a new link" pending="Sending..." size="default" />
      </div>
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
