"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type MouseEvent, type ReactNode } from "react";
import {
  BarChart3,
  ChevronRight,
  ClipboardCheck,
  LayoutDashboard,
  Package,
  Settings,
  SlidersHorizontal,
  Wrench,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { UserMenu } from "./user-menu";
import { BrandLogo, TagXLogo } from "./brand-logo";
import type { SidebarAdminNav } from "@/lib/permissions/admin-sections";
import type { CompanyBranding } from "@/modules/companies/types";
import type { CurrentUser } from "@/modules/users/types";

function SidebarLink({
  href,
  label,
  icon,
  active,
}: {
  href: string;
  label: string;
  icon: ReactNode;
  active: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();

  function navigate(event: MouseEvent<HTMLAnchorElement>) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      return;
    }
    event.preventDefault();
    const [path, hash] = href.split("#");
    if (pathname === path && !hash) {
      return;
    }
    router.push(href);
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={active} tooltip={label}>
        <Link href={href} prefetch onClick={navigate}>
          {icon}
          <span>{label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function AppSidebar({
  company,
  user,
  adminNav,
}: {
  company: CompanyBranding | null;
  user: CurrentUser | null;
  adminNav: SidebarAdminNav;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { setOpen, state } = useSidebar();
  const isVendor = Boolean(user?.vendorId);
  const isPathActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const isUsersAndRolesActive =
    isPathActive("/dashboard/administration/users") ||
    isPathActive("/dashboard/administration/roles") ||
    isPathActive("/dashboard/administration/vendors");
  const isCatalogActive =
    isUsersAndRolesActive || adminNav.catalogSections.some((section) => isPathActive(section.href));
  const [adminOpen, setAdminOpen] = useState(isCatalogActive);

  function toggleAdministration() {
    if (state === "collapsed") {
      setOpen(true);
      setAdminOpen(true);
      return;
    }
    setAdminOpen((open) => !open);
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-16 shrink-0 justify-center border-b border-slate-200 bg-white px-3 group-data-[collapsible=icon]:px-2">
        <Link
          href={isVendor ? "/assets" : "/dashboard"}
          className="flex h-full min-w-0 items-center gap-2.5 group-data-[collapsible=icon]:justify-center"
        >
          <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg border border-slate-200 bg-white">
            {company?.logoUrl ? (
              <BrandLogo
                src={company.logoUrl}
                alt=""
                size={40}
                fallback={false}
                className="size-9 object-contain"
              />
            ) : (
              <TagXLogo size={28} className="h-7 w-7 object-contain" />
            )}
          </span>
          <span className="min-w-0 group-data-[collapsible=icon]:hidden">
            <span className="block truncate text-sm font-semibold leading-tight text-slate-900">
              {company?.name ?? "TagX"}
            </span>
            {user?.role?.name ? (
              <span className="block truncate text-xs leading-tight text-slate-500">{user.role.name}</span>
            ) : null}
          </span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {!isVendor ? (
                <SidebarLink href="/dashboard" label="Dashboard" icon={<LayoutDashboard />} active={pathname === "/dashboard"} />
              ) : null}

              {adminNav.assets ? (
                <SidebarLink
                  href="/assets"
                  label={isVendor ? "Assigned assets" : "Assets"}
                  icon={<Package />}
                  active={isPathActive("/assets")}
                />
              ) : null}

              {adminNav.maintenance ? (
                <SidebarLink
                  href={adminNav.maintenance.href}
                  label="Maintenance"
                  icon={<Wrench />}
                  active={isPathActive(adminNav.maintenance.href)}
                />
              ) : null}

              {adminNav.audits ? (
                <SidebarLink
                  href={adminNav.audits.href}
                  label="Audits"
                  icon={<ClipboardCheck />}
                  // The per-audit scanner lives under /floor/audits/[id].
                  active={isPathActive(adminNav.audits.href) || isPathActive("/floor/audits")}
                />
              ) : null}

              {adminNav.reports ? (
                <SidebarLink
                  href={adminNav.reports.href}
                  label="Reports"
                  icon={<BarChart3 />}
                  active={isPathActive(adminNav.reports.href)}
                />
              ) : null}

              {adminNav.catalogSections.length > 0 ? (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    type="button"
                    isActive={isCatalogActive}
                    tooltip="Company setup"
                    onClick={toggleAdministration}
                  >
                    <SlidersHorizontal />
                    <span>Company setup</span>
                    <ChevronRight className={`ml-auto transition-transform ${adminOpen ? "rotate-90" : ""}`} />
                  </SidebarMenuButton>
                  {adminOpen ? (
                    <SidebarMenuSub>
                      {adminNav.catalogSections.map((section) => (
                        <SidebarMenuSubItem key={section.href}>
                          <SidebarMenuSubButton
                            asChild
                            isActive={
                              section.module === "users" || section.module === "roles" || section.module === "vendors"
                                ? isUsersAndRolesActive
                                : isPathActive(section.href)
                            }
                          >
                            <Link
                              href={section.href}
                              prefetch
                              onClick={(event) => {
                                if (
                                  event.metaKey ||
                                  event.ctrlKey ||
                                  event.shiftKey ||
                                  event.altKey ||
                                  event.button !== 0
                                ) {
                                  return;
                                }
                                event.preventDefault();
                                router.push(section.href);
                              }}
                            >
                              <span>{section.title}</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  ) : null}
                </SidebarMenuItem>
              ) : null}

              {adminNav.settings ? (
                <SidebarLink
                  href={adminNav.settings.href}
                  label="Settings"
                  icon={<Settings />}
                  active={
                    isPathActive(adminNav.settings.href) ||
                    isPathActive("/dashboard/administration/notifications") ||
                    isPathActive("/dashboard/administration/activity")
                  }
                />
              ) : null}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-white/10">
        {user ? (
          <SidebarMenu>
            <SidebarMenuItem>
              <UserMenu user={user} from="tenant" />
            </SidebarMenuItem>
          </SidebarMenu>
        ) : null}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
