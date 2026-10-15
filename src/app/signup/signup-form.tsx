"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
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

  const continueHref = planId ? `/signup/continue?plan=${planId}` : "/signup/continue";

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
      {state.existingAccount ? (
        <div role="alert" className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p>
            <span className="font-semibold">You already started signing up with this email.</span> The password
            doesn&apos;t match the one you chose then.
          </p>
          <Link href={continueHref} className="font-medium underline underline-offset-4">
            Continue with your existing password, or reset it
          </Link>
        </div>
      ) : null}
      <Button type="submit" disabled={isPending}>
        {isPending ? "Creating account..." : "Create account"}
      </Button>
    </form>
  );
}
