import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { TopBar } from "@/components/layout/top-bar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { brandingStyle } from "@/lib/color";
import { companyPageMetadata } from "@/lib/company-metadata";
import { getRequestAuthUser } from "@/lib/supabase/server";
import { TENANT_SLUG_COOKIE, tenantLoginPathFromCookie } from "@/lib/tenant";
import { getSidebarAdminNav } from "@/lib/permissions/admin-sections";
import { getCurrentCompany } from "@/modules/companies/actions";
import { getCurrentUser } from "@/modules/users/actions";

export async function generateMetadata(): Promise<Metadata> {
  const company = await getCurrentCompany();
  return companyPageMetadata(company);
}

// Shell (sidebar + top bar) for the whole authenticated app: /dashboard,
// /assets, and any future section added under this route group.
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getRequestAuthUser();

  // Defense in depth: middleware.ts already redirects unauthenticated
  // visits to /dashboard/** and /assets/**, this just makes sure the shell
  // never renders without a session even if middleware's matcher config
  // ever changes.
  if (!user) {
    redirect(tenantLoginPathFromCookie(cookies().get(TENANT_SLUG_COOKIE)?.value) ?? "/");
  }

  const sidebarState = cookies().get("sidebar_state")?.value;
  const [adminNav, company, currentUser] = await Promise.all([
    getSidebarAdminNav(),
    getCurrentCompany(),
    getCurrentUser(),
  ]);

  return (
    <SidebarProvider
      defaultOpen={sidebarState !== "false"}
      style={brandingStyle(company?.primaryColor, company?.secondaryColor)}
    >
      <AppSidebar adminNav={adminNav} company={company} user={currentUser} />
      <SidebarInset>
        <TopBar />
        <main className="flex-1 p-4 @container md:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
