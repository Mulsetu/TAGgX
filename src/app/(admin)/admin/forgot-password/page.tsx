import { TagXLogo } from "@/components/layout/brand-logo";
import { AuthShell } from "@/components/auth/auth-shell";
import { AdminForgotPasswordForm } from "./forgot-password-form";

export default function AdminForgotPasswordPage() {
  return (
    <AuthShell
      logo={<TagXLogo size={120} className="h-14 w-auto max-w-[14rem]" />}
      title="Platform admin"
      subtitle="Reset your password"
      showPoweredBy={false}
    >
      <AdminForgotPasswordForm />
    </AuthShell>
  );
}
