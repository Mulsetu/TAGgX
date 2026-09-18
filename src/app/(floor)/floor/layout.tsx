import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/layout/brand-logo";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { brandingStyle } from "@/lib/color";
import { companyPageMetadata } from "@/lib/company-metadata";
import { getRequestAuthUser } from "@/lib/supabase/server";
import { TENANT_SLUG_COOKIE, tenantLoginPathFromCookie } from "@/lib/tenant";
import { assertModule } from "@/lib/permissions/features";
import { assertPermission } from "@/lib/permissions/has-permission";
import { getCurrentCompany } from "@/modules/companies/actions";

export async function generateMetadata(): Promise<Metadata> {
  const company = await getCurrentCompany();
  return {
    ...companyPageMetadata(company, "Floor audit"),
    robots: { index: false, follow: false },
  };
}

export default async function FloorLayout({ children }: { children: React.ReactNode }) {
  const user = await getRequestAuthUser();
  if (!user) {
    redirect(tenantLoginPathFromCookie(cookies().get(TENANT_SLUG_COOKIE)?.value) ?? "/");
  }

  await assertModule("audits");
  await assertPermission("audits", "view");

  const company = await getCurrentCompany();

  return (
    <div
      className="flex min-h-dvh flex-col bg-background"
      style={brandingStyle(company?.primaryColor, company?.secondaryColor)}
    >
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/95 px-4 pt-[env(safe-area-inset-top)] backdrop-blur">
        <BrandLogo
          src={company?.logoUrl}
          alt={company?.name ?? "TagX by Mulsetu"}
          size={28}
          variant={company?.logoUrl ? "icon" : "logo"}
          className={company?.logoUrl ? "size-7 rounded-md" : "h-7 w-auto max-w-[10rem]"}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{company?.name ?? "TagX"}</p>
          <p className="text-xs text-muted-foreground">Floor audit</p>
        </div>
        <Link
          href="/dashboard"
          className="inline-flex h-11 items-center text-xs text-muted-foreground hover:underline"
        >
          Desk
        </Link>
        <SignOutButton variant="ghost" from="tenant" />
      </header>
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 px-4 py-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        {children}
      </main>
    </div>
  );
}
