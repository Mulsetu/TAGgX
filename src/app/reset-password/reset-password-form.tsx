"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { updatePasswordAction } from "@/modules/users/actions";
import type { ResetPasswordState } from "@/modules/users/types";

const initialState: ResetPasswordState = { success: false, error: null };

/**
 * The one-time recovery token comes from the Brevo email's link
 * (`?token_hash=`). It is only redeemed when this form is submitted, so
 * opening the link — or a mail scanner prefetching it — doesn't use it up.
 */
export function ResetPasswordForm({ redirectPath, tokenHash }: { redirectPath: string; tokenHash: string }) {
  const router = useRouter();
  const [state, setState] = useState<ResetPasswordState>(initialState);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    formData.set("tokenHash", tokenHash);
    startTransition(async () => {
      const result = await updatePasswordAction(initialState, formData);
      setState(result);
      if (result.success) {
        setTimeout(() => router.push(redirectPath), 1500);
      }
    });
  }

  if (!tokenHash) {
    return (
      <p className="max-w-sm text-center text-sm text-destructive">
        This reset link is invalid or has expired. Request a new one from the login page.
      </p>
    );
  }

  if (state.success) {
    return (
      <p className="max-w-sm text-center text-sm text-muted-foreground">
        Password updated. Redirecting you to sign in...
      </p>
    );
  }

  return (
    <form action={handleSubmit} className="flex w-full max-w-sm flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">New password</Label>
        <PasswordInput id="password" name="password" autoComplete="new-password" required minLength={8} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="confirmPassword">Confirm password</Label>
        <PasswordInput
          id="confirmPassword"
          name="confirmPassword"
          autoComplete="new-password"
          required
          minLength={8}
        />
      </div>
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Updating..." : "Update password"}
      </Button>
    </form>
  );
}
