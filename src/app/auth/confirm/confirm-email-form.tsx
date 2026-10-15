"use client";

import { useFormState } from "react-dom";
import Link from "next/link";
import { PendingSubmitButton } from "@/components/auth/pending-submit-button";
import { ResendVerificationForm } from "@/components/auth/resend-verification-form";
import { confirmSignupEmailAction } from "@/modules/users/actions";
import type { ConfirmSignupEmailState } from "@/modules/users/types";

const initialState: ConfirmSignupEmailState = { error: null };

export function ConfirmEmailForm({
  tokenHash,
  planId,
  verificationType,
}: {
  tokenHash: string;
  planId: string;
  verificationType: string;
}) {
  const [state, formAction] = useFormState(confirmSignupEmailAction, initialState);

  if (state.expired) {
    return (
      <div className="flex flex-col gap-4">
        <p role="alert" className="text-sm text-destructive">
          {state.error} Links work once and expire after a while — get a new one below.
        </p>
        <ResendVerificationForm planId={planId || undefined} />
        <p className="text-xs text-muted-foreground">
          Already verified?{" "}
          <Link href={planId ? `/signup/continue?plan=${planId}` : "/signup/continue"} className="underline underline-offset-4">
            Continue your signup
          </Link>{" "}
          with your email and password.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="tokenHash" value={tokenHash} />
      {planId ? <input type="hidden" name="planId" value={planId} /> : null}
      {verificationType ? <input type="hidden" name="verificationType" value={verificationType} /> : null}
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <PendingSubmitButton idle="Confirm email and continue" pending="Confirming..." />
    </form>
  );
}
