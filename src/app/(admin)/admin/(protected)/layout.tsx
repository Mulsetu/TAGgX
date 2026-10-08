import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminSidebar } from "@/components/layout/admin-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { companyShellStyle } from "@/lib/color";
import { checkSuperAdmin } from "@/lib/permissions/super-admin";
import { createClient, getRequestAuthUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "TagX Admin",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const user = await getRequestAuthUser();

  // Defense in depth: middleware.ts already redirects non-super-admins
  // away from /admin/**, this just makes sure the section never renders
  // without that check even if middleware's matcher config ever changes.
  if (!user || !(await checkSuperAdmin(supabase, user.id))) {
    redirect("/admin/login");
  }

  const sidebarState = cookies().get("sidebar_state")?.value;

  return (
    <SidebarProvider
      defaultOpen={sidebarState !== "false"}
      className="company-shell"
      style={companyShellStyle(null, null)}
    >
      <AdminSidebar email={user.email ?? "Platform admin"} />
      <SidebarInset className="bg-[#F4F7FB]">
        <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4">
          <SidebarTrigger className="size-10 text-slate-600 md:size-8" />
          <p className="text-sm font-medium text-slate-700">Platform admin</p>
        </header>
        <main className="company-page flex-1 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] @container md:p-6">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
