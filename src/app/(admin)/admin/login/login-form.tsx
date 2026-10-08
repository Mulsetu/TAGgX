import Link from "next/link";
import { PendingSubmitButton } from "@/components/auth/pending-submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { signInSuperAdmin } from "@/modules/users/actions";

const ADMIN_LOGIN_ERRORS: Record<string, string> = {
  invalid: "Invalid email or password.",
  rate: "Try again later.",
  forbidden: "This account is not a platform administrator.",
};

export function AdminLoginForm({ errorCode }: { errorCode?: string }) {
  const error = errorCode ? ADMIN_LOGIN_ERRORS[errorCode] : undefined;

  return (
    <form action={signInSuperAdmin} className="flex w-full max-w-sm flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <Link href="/admin/forgot-password" className="text-xs text-muted-foreground hover:underline">
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
      <PendingSubmitButton idle="Sign in" pending="Signing in..." className="w-full" size="default" />
    </form>
  );
}
