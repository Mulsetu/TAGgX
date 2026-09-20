import { TagXLogo } from "@/components/layout/brand-logo";
import { AdminForgotPasswordForm } from "./forgot-password-form";

export default function AdminForgotPasswordPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-4">
      <div className="flex flex-col items-center gap-3">
        <TagXLogo size={220} className="h-40 w-40" />
        <p className="text-sm text-muted-foreground">Reset your password</p>
      </div>
      <AdminForgotPasswordForm />
    </main>
  );
}
