"use client";

import { useFormState } from "react-dom";
import { PendingSubmitButton } from "@/components/auth/pending-submit-button";
import { confirmSignupEmailAction } from "@/modules/users/actions";
import type { ConfirmSignupEmailState } from "@/modules/users/types";

const initialState: ConfirmSignupEmailState = { error: null };

export function ConfirmEmailForm({ tokenHash, planId }: { tokenHash: string; planId: string }) {
  const [state, formAction] = useFormState(confirmSignupEmailAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="tokenHash" value={tokenHash} />
      {planId ? <input type="hidden" name="planId" value={planId} /> : null}
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <PendingSubmitButton idle="Confirm email and continue" pending="Confirming..." />
    </form>
  );
}
