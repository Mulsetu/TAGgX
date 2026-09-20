import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { TagXLogo } from "@/components/layout/brand-logo";
import { createClient, getRequestAuthUser } from "@/lib/supabase/server";
import { checkSuperAdmin } from "@/lib/permissions/super-admin";
import { SignOutButton } from "@/components/layout/sign-out-button";

export const metadata: Metadata = {
  title: "TagX Admin",
  robots: { index: false, follow: false },
};

const NAV_LINKS = [
  { href: "/admin", label: "Companies" },
  { href: "/admin/leads", label: "Leads" },
  { href: "/admin/plans", label: "Plans" },
  { href: "/admin/orders", label: "Asset orders" },
  { href: "/admin/payments", label: "Payments" },
  { href: "/admin/storage", label: "Storage usage" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const user = await getRequestAuthUser();

  // Defense in depth: middleware.ts already redirects non-super-admins
  // away from /admin/**, this just makes sure the section never renders
  // without that check even if middleware's matcher config ever changes.
  if (!user || !(await checkSuperAdmin(supabase, user.id))) {
    redirect("/admin/login");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-16 shrink-0 items-center gap-6 border-b px-4">
        <TagXLogo size={64} className="h-9 w-auto max-w-[11rem]" />
        <nav className="flex items-center gap-4">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-4">
          <span className="truncate text-sm text-muted-foreground">{user.email}</span>
          <SignOutButton variant="ghost" from="admin" />
        </div>
      </header>
      <main className="flex-1 p-4 @container md:p-6">{children}</main>
    </div>
  );
}
