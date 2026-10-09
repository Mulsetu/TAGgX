import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { notFound } from "next/navigation";
import { BrandLogo, TagXLogo } from "@/components/layout/brand-logo";
import { companyShellStyle } from "@/lib/color";
import { companyPageMetadata } from "@/lib/company-metadata";
import { safePostLoginPath } from "@/lib/paths";
import { getCompanyForLogin } from "@/modules/companies/actions";
import { LoginForm } from "./login-form";

/** Always hit Supabase for slug → company; never serve a cached 404 miss. */
export const dynamic = "force-dynamic";

interface TenantLoginPageProps {
  params: { slug: string };
  searchParams: { next?: string; error?: string };
}

export async function generateMetadata({ params }: TenantLoginPageProps): Promise<Metadata> {
  const company = await getCompanyForLogin(params.slug);
  return {
    ...companyPageMetadata(company, "Sign in"),
    robots: { index: false, follow: false },
  };
}

export default async function TenantLoginPage({ params, searchParams }: TenantLoginPageProps) {
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
      subtitle="Sign in to your workspace"
    >
      <LoginForm
        slug={company.slug}
        nextPath={safePostLoginPath(searchParams.next)}
        errorCode={searchParams.error}
      />
    </AuthShell>
  );
}
