"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { signupAccountAction } from "@/modules/users/actions";
import type { AccountSignupState } from "@/modules/users/types";

const initialState: AccountSignupState = { error: null };

export function SignupForm({ planId }: { planId?: string }) {
  const router = useRouter();
  const [state, setState] = useState<AccountSignupState>(initialState);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await signupAccountAction(initialState, formData);
      if (result.redirectPath) {
        router.push(result.redirectPath);
        return;
      }
      if (result.checkEmail) {
        router.push("/signup/check-email");
        return;
      }
      setState(result);
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-4">
      {planId ? <input type="hidden" name="planId" value={planId} /> : null}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="fullName">Your name</Label>
        <Input id="fullName" name="fullName" required maxLength={200} autoComplete="name" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Work email</Label>
        <Input id="email" name="email" type="email" required autoComplete="email" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Password</Label>
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
      <Button type="submit" disabled={isPending}>
        {isPending ? "Creating account..." : "Create account"}
      </Button>
    </form>
  );
}
