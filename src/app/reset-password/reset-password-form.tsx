"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { updatePasswordAction } from "@/modules/users/actions";
import type { ResetPasswordState } from "@/modules/users/types";

const initialState: ResetPasswordState = { success: false, error: null };

/**
 * The recovery access/refresh tokens Supabase puts in the emailed link
 * live in the URL *fragment* (`#access_token=...`), which never reaches
 * the server — has to be read here, client-side, then handed to the
 * updatePasswordAction Server Action to actually apply.
 */
export function ResetPasswordForm({ redirectPath }: { redirectPath: string }) {
  const router = useRouter();
  const [tokens, setTokens] = useState<{ accessToken: string; refreshToken: string } | null>(null);
  const [tokenError, setTokenError] = useState(false);
  const [state, setState] = useState<ResetPasswordState>(initialState);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = hash.get("access_token");
    const refreshToken = hash.get("refresh_token");
    if (accessToken && refreshToken) {
      setTokens({ accessToken, refreshToken });
    } else {
      setTokenError(true);
    }
  }, []);

  function handleSubmit(formData: FormData) {
    if (!tokens) return;

    startTransition(async () => {
      const result = await updatePasswordAction(tokens.accessToken, tokens.refreshToken, initialState, formData);
      setState(result);
      if (result.success) {
        setTimeout(() => router.push(redirectPath), 1500);
      }
    });
  }

  if (tokenError) {
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
      <Button type="submit" className="w-full" disabled={isPending || !tokens}>
        {isPending ? "Updating..." : "Update password"}
      </Button>
    </form>
  );
}
