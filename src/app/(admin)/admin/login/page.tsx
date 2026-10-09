import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { TagXLogo } from "@/components/layout/brand-logo";
import { AdminLoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Platform admin sign in",
  robots: { index: false, follow: false },
};

export default function AdminLoginPage({ searchParams }: { searchParams?: { error?: string } }) {
  return (
    <AuthShell
      logo={<TagXLogo size={120} className="h-14 w-auto max-w-[14rem]" />}
      title="Platform admin"
      subtitle="Sign in to manage companies, plans and billing"
      showPoweredBy={false}
    >
      <AdminLoginForm errorCode={searchParams?.error} />
    </AuthShell>
  );
}
