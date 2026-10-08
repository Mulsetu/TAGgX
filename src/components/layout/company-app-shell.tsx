import { cookies } from "next/headers";
import { companyShellStyle } from "@/lib/color";
import { redirect } from "next/navigation";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TENANT_SLUG_COOKIE, tenantLoginPathFromCookie } from "@/lib/tenant";
import { getSidebarAdminNav } from "@/lib/permissions/admin-sections";
import { getTenantAccessState } from "@/lib/permissions/tenant-access";
import { getRequestAuthUser } from "@/lib/supabase/server";
import { getCurrentCompany } from "@/modules/companies/actions";
import { getCurrentUser } from "@/modules/users/actions";
import { AppSidebar } from "./app-sidebar";
import { TenantReadOnlyBanner } from "./tenant-read-only-banner";
import { TopBar } from "./top-bar";

export async function CompanyAppShell({ children }: { children: React.ReactNode }) {
  const user = await getRequestAuthUser();

  if (!user) {
    redirect(tenantLoginPathFromCookie(cookies().get(TENANT_SLUG_COOKIE)?.value) ?? "/");
  }

  const currentUser = await getCurrentUser();
  if (currentUser && !currentUser.companyId) {
    redirect("/onboarding");
  }

  const sidebarState = cookies().get("sidebar_state")?.value;
  const [adminNav, company, access] = await Promise.all([
    getSidebarAdminNav(),
    getCurrentCompany(),
    getTenantAccessState(),
  ]);

  return (
    <SidebarProvider
      defaultOpen={sidebarState !== "false"}
      className="company-shell"
      style={companyShellStyle(company?.primaryColor, company?.secondaryColor)}
    >
      <AppSidebar adminNav={adminNav} company={company} user={currentUser} />
      <SidebarInset className="bg-[#F4F7FB]">
        <TopBar />
        <TenantReadOnlyBanner access={access} />
        <main className="company-page flex-1 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] @container md:p-6">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
