import Link from "next/link";
import { PendingSubmitButton } from "@/components/auth/pending-submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { signIn } from "@/modules/users/actions";

const LOGIN_ERRORS: Record<string, string> = {
  invalid: "Invalid email or password.",
  rate: "Try again later.",
  missing: "This company could not be found.",
  mismatch: "No account was found for this company.",
  onboarding: "Finish creating your workspace before signing in here.",
  suspended: "This workspace is unavailable.",
};

export function LoginForm({
  slug,
  nextPath,
  errorCode,
}: {
  slug: string;
  nextPath?: string | null;
  errorCode?: string;
}) {
  const error = errorCode ? LOGIN_ERRORS[errorCode] : undefined;

  return (
    <form action={signIn.bind(null, slug, nextPath ?? null)} className="flex w-full max-w-sm flex-col gap-4 px-1">
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
      <PendingSubmitButton idle="Sign in" pending="Signing in..." className="w-full" />
      <p className="text-center text-xs leading-5 text-muted-foreground">
        Walking an audit? Sign in on this phone, then scan each TagX sticker with the Camera app.
      </p>
    </form>
  );
}
