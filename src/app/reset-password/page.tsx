import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { BrandLogo } from "@/components/layout/brand-logo";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = {
  title: "Reset password",
  robots: { index: false, follow: false },
};

interface ResetPasswordPageProps {
  searchParams: { redirect?: string };
}

export default function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  // Only ever follow an internal path — never let an open ?redirect=
  // param send someone to an external URL.
  const redirectPath =
    searchParams.redirect && searchParams.redirect.startsWith("/") ? searchParams.redirect : "/";

  return (
    <AuthShell
      logo={<BrandLogo alt="TagX by Mulsetu" size={80} className="h-14 w-auto max-w-[14rem]" />}
      title="Choose a new password"
      subtitle="Use at least 8 characters."
      showPoweredBy={false}
    >
      <ResetPasswordForm redirectPath={redirectPath} />
    </AuthShell>
  );
}
