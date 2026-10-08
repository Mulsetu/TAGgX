import type { Metadata } from "next";
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
    <main
      className="flex min-h-dvh flex-col items-center justify-center gap-8 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]"
      style={companyShellStyle(company.primaryColor, company.secondaryColor)}
    >
      <div className="flex flex-col items-center gap-3">
        <BrandLogo
          src={company.logoUrl}
          alt={`${company.name} logo`}
          size={56}
          fallback={false}
          className="h-14 w-14 rounded-md"
        />
        <h1 className="text-xl font-semibold text-[hsl(var(--brand-primary))]">{company.name}</h1>
      </div>
      <LoginForm
        slug={company.slug}
        nextPath={safePostLoginPath(searchParams.next)}
        errorCode={searchParams.error}
      />
      <TagXLogo size={96} className="h-12 w-auto max-w-[14rem]" />
    </main>
  );
}
