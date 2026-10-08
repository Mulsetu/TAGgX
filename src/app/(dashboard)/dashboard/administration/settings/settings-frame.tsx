import type { ReactNode } from "react";
import { SectionTabs, type SectionTab } from "@/components/layout/section-tabs";
import { requireModule } from "@/lib/permissions/features";
import { requirePermission } from "@/lib/permissions/has-permission";

const SETTINGS_TABS: SectionTab[] = [
  { title: "Branding", href: "/dashboard/administration/settings/branding" },
  { title: "Modules", href: "/dashboard/administration/settings/modules" },
  { title: "Dashboard", href: "/dashboard/administration/settings/dashboard" },
  { title: "Workspace", href: "/dashboard/administration/settings/workspace" },
  { title: "Billing", href: "/dashboard/administration/settings/billing" },
  { title: "Data", href: "/dashboard/administration/settings/data" },
];

export async function SettingsFrame({ children }: { children: ReactNode }) {
  const [canSettings, canNotifications] = await Promise.all([
    requirePermission("settings", "view"),
    Promise.all([requireModule("email"), requirePermission("notifications", "view")]).then(
      ([emailOn, canView]) => emailOn && canView,
    ),
  ]);

  const tabs: SectionTab[] = [
    ...(canSettings ? SETTINGS_TABS.slice(0, 5) : []),
    ...(canNotifications ? [{ title: "Notifications", href: "/dashboard/administration/notifications" }] : []),
    ...(canSettings ? [{ title: "Activity", href: "/dashboard/administration/activity" }, SETTINGS_TABS[5]!] : []),
  ];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-slate-500">
          Branding, which parts of the workspace are on, the home dashboard, billing, and data.
        </p>
      </div>
      <SectionTabs tabs={tabs} />
      {children}
    </div>
  );
}
