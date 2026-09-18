import { TagXLogo } from "@/components/layout/brand-logo";
import { AdminForgotPasswordForm } from "./forgot-password-form";

export default function AdminForgotPasswordPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-4">
      <div className="flex flex-col items-center gap-3">
        <TagXLogo size={180} className="h-16 w-auto max-w-xs md:h-20" />
        <p className="text-sm text-muted-foreground">Reset your password</p>
      </div>
      <AdminForgotPasswordForm />
    </main>
  );
}
