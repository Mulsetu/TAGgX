"use client";

import { useRef, useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { RequiredMark } from "@/components/ui/required-mark";
import { changeOwnPasswordAction } from "@/modules/users/actions";
import type { ChangePasswordState } from "@/modules/users/types";

const initialState: ChangePasswordState = { error: null };

export function ChangePasswordForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, setState] = useState<ChangePasswordState>(initialState);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await changeOwnPasswordAction(initialState, formData);
      setState(result);
      if (result.success) {
        formRef.current?.reset();
      }
    });
  }

  return (
    <form ref={formRef} action={handleSubmit} className="flex max-w-md flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="currentPassword">
          Current password
          <RequiredMark />
        </Label>
        <PasswordInput id="currentPassword" name="currentPassword" autoComplete="current-password" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="newPassword">
          New password
          <RequiredMark />
        </Label>
        <PasswordInput id="newPassword" name="newPassword" autoComplete="new-password" minLength={8} maxLength={72} required />
        <p className="text-xs text-slate-500">At least 8 characters.</p>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="confirmPassword">
          Confirm new password
          <RequiredMark />
        </Label>
        <PasswordInput id="confirmPassword" name="confirmPassword" autoComplete="new-password" minLength={8} maxLength={72} required />
      </div>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state.success ? (
        <p className="flex items-center gap-1.5 text-sm text-emerald-700">
          <CheckCircle2 className="size-4" />
          Password changed. You&apos;ve been signed out on your other devices.
        </p>
      ) : null}
      <Button type="submit" disabled={isPending} className="self-start">
        {isPending ? "Changing..." : "Change password"}
      </Button>
    </form>
  );
}
