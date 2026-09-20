import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BrandLogo, TagXLogo } from "@/components/layout/brand-logo";
import { brandingStyle } from "@/lib/color";
import { companyPageMetadata } from "@/lib/company-metadata";
import { safePostLoginPath } from "@/lib/paths";
import { getCompanyForLogin } from "@/modules/companies/actions";
import { LoginForm } from "./login-form";

interface TenantLoginPageProps {
  params: { slug: string };
  searchParams: { next?: string };
}

export async function generateMetadata({ params }: TenantLoginPageProps): Promise<Metadata> {
  const company = await getCompanyForLogin(params.slug);
  return companyPageMetadata(company, "Sign in");
}

export default async function TenantLoginPage({ params, searchParams }: TenantLoginPageProps) {
  const company = await getCompanyForLogin(params.slug);

  if (!company) {
    notFound();
  }

  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center gap-8 px-4"
      style={brandingStyle(company.primaryColor, company.secondaryColor)}
    >
      <div className="flex flex-col items-center gap-3">
        <BrandLogo
          src={company.logoUrl}
          alt={`${company.name} logo`}
          size={56}
          fallback={false}
          className="h-14 w-14 rounded-md"
        />
        <h1 className="text-xl font-semibold text-primary">{company.name}</h1>
      </div>
      <LoginForm slug={company.slug} nextPath={safePostLoginPath(searchParams.next)} />
      <TagXLogo size={120} className="h-[7.5rem] w-[7.5rem]" />
    </main>
  );
}
