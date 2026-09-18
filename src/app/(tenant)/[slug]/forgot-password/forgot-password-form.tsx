"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordResetAction } from "@/modules/users/actions";
import type { ForgotPasswordState } from "@/modules/users/types";

const initialState: ForgotPasswordState = { submitted: false, error: null };

export function ForgotPasswordForm({ slug }: { slug: string }) {
  const [state, setState] = useState<ForgotPasswordState>(initialState);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await requestPasswordResetAction(`/${slug}/login`, initialState, formData);
      setState(result);
    });
  }

  if (state.submitted) {
    return (
      <p className="max-w-sm text-center text-sm text-muted-foreground">
        If an account exists for that email, a password reset link is on its way.
      </p>
    );
  }

  return (
    <form action={handleSubmit} className="flex w-full max-w-sm flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Sending..." : "Send reset link"}
      </Button>
    </form>
  );
}
