import type { Metadata } from "next";
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
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-4">
      <div className="flex flex-col items-center gap-3">
        <BrandLogo alt="TagX by Mulsetu" size={80} className="h-14 w-auto max-w-[16rem]" />
        <h1 className="text-xl font-semibold">Reset your password</h1>
      </div>
      <ResetPasswordForm redirectPath={redirectPath} />
    </main>
  );
}
