"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { signIn } from "@/modules/users/actions";

// react-dom's useFormState/useFormStatus need the canary channel; this
// project is on stable React 18, so pending/error state is tracked by hand
// with useTransition instead.
export function LoginForm({ slug, nextPath }: { slug: string; nextPath?: string | null }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await signIn(slug, nextPath ?? null, { error: null }, formData);
      if (result.redirectPath) {
        window.location.assign(result.redirectPath);
        return;
      }
      setError(result.error);
    });
  }

  return (
    <form action={handleSubmit} className="flex w-full max-w-sm flex-col gap-4 px-1">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <Link href={`/${slug}/forgot-password`} className="text-xs text-muted-foreground hover:underline">
            Forgot password?
          </Link>
        </div>
        <PasswordInput id="password" name="password" autoComplete="current-password" required />
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" className="w-full" size="touch" disabled={isPending}>
        {isPending ? "Signing in..." : "Sign in"}
      </Button>
      <p className="text-center text-xs leading-5 text-muted-foreground">
        Walking an audit? Sign in on this phone, then scan each TagX sticker with the Camera app.
      </p>
    </form>
  );
}
