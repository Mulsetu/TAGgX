import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { notFound } from "next/navigation";
import { BrandLogo, TagXLogo } from "@/components/layout/brand-logo";
import { companyShellStyle } from "@/lib/color";
import { companyPageMetadata } from "@/lib/company-metadata";
import { getCompanyForLogin } from "@/modules/companies/actions";
import { ForgotPasswordForm } from "./forgot-password-form";

interface ForgotPasswordPageProps {
  params: { slug: string };
}

export async function generateMetadata({ params }: ForgotPasswordPageProps): Promise<Metadata> {
  const company = await getCompanyForLogin(params.slug);
  return {
    ...companyPageMetadata(company, "Reset password"),
    robots: { index: false, follow: false },
  };
}

export default async function ForgotPasswordPage({ params }: ForgotPasswordPageProps) {
  const company = await getCompanyForLogin(params.slug);

  if (!company) {
    notFound();
  }

  return (
    <AuthShell
      style={companyShellStyle(company.primaryColor, company.secondaryColor)}
      logo={
        company.logoUrl ? (
          <BrandLogo
            src={company.logoUrl}
            alt={`${company.name} logo`}
            size={56}
            fallback={false}
            className="h-14 w-14 rounded-lg"
          />
        ) : (
          <TagXLogo size={64} className="h-12 w-auto max-w-[12rem]" />
        )
      }
      title={company.name}
      subtitle="Reset your password"
    >
      <ForgotPasswordForm slug={company.slug} />
    </AuthShell>
  );
}
