import { requirePermission } from "@/lib/permissions/has-permission";
import { SectionTabs, type SectionTab } from "@/components/layout/section-tabs";
import { redirect } from "next/navigation";

const TABS: (SectionTab & { module: "users" | "roles" })[] = [
  { title: "Users", href: "/dashboard/administration/users", module: "users" },
  { title: "Roles & permissions", href: "/dashboard/administration/roles", module: "roles" },
];

export default async function UsersAndRolesLayout({ children }: { children: React.ReactNode }) {
  const visibleTabs = await Promise.all(
    TABS.map(async (tab) => ((await requirePermission(tab.module, "view")) ? tab : null)),
  );
  const tabs: SectionTab[] = visibleTabs.filter(
    (tab): tab is (typeof TABS)[number] => tab !== null,
  );

  if (tabs.length === 0) {
    redirect("/dashboard");
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Users & roles</h1>
        <p className="text-sm text-slate-500">Invite people and choose what each role can open.</p>
      </div>
      <SectionTabs tabs={tabs} />
      {children}
    </div>
  );
}
