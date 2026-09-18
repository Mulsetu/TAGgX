"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { acceptInviteAction } from "@/modules/users/actions";
import type { AcceptInviteState } from "@/modules/users/types";

const initialState: AcceptInviteState = { error: null };

export function AcceptInviteForm({ token }: { token: string }) {
  const router = useRouter();
  const [state, setState] = useState<AcceptInviteState>(initialState);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await acceptInviteAction(token, initialState, formData);
      if (result.redirectPath) {
        router.push(result.redirectPath);
        return;
      }
      setState(result);
    });
  }

  return (
    <form action={handleSubmit} className="flex w-full max-w-sm flex-col gap-4">
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
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Setting up..." : "Set password and continue"}
      </Button>
    </form>
  );
}
