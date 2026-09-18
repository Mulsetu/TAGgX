"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, LayoutDashboard, Package, QrCode, ScrollText, Settings, ShieldCheck, Wrench } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
} from "@/components/ui/sidebar";
import { UserMenu } from "./user-menu";
import { BrandLogo } from "./brand-logo";
import type { SidebarAdminNav } from "@/lib/permissions/admin-sections";
import type { CompanyBranding } from "@/modules/companies/types";
import type { CurrentUser } from "@/modules/users/types";

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
  const isVendor = Boolean(user?.vendorId);
  const isPathActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const isUsersAndRolesActive =
    isPathActive("/dashboard/administration/users") || isPathActive("/dashboard/administration/roles");
  const isCatalogActive =
    isUsersAndRolesActive || adminNav.catalogSections.some((section) => isPathActive(section.href));

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex h-8 items-center gap-2 px-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <BrandLogo
            src={company?.logoUrl}
            alt={company?.name ?? "TagX by Mulsetu"}
            size={28}
            variant="logo"
            className={
              company?.logoUrl
                ? "size-7 shrink-0 rounded-sm object-contain"
                : "h-6 w-auto max-w-[9.5rem] shrink-0 object-contain group-data-[collapsible=icon]:h-4 group-data-[collapsible=icon]:max-w-[2.75rem]"
            }
          />
          <span className="truncate text-sm font-semibold group-data-[collapsible=icon]:hidden">
            {company?.name ? `${company.name} · TagX` : "TagX"}
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {!isVendor ? (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname === "/dashboard"} tooltip="Dashboard">
                    <Link href="/dashboard">
                      <LayoutDashboard />
                      <span>Dashboard</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ) : null}

              {adminNav.assets ? (
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isPathActive("/assets")} tooltip={isVendor ? "Assigned assets" : "Assets"}>
                  <Link href="/assets">
                    <Package />
                    <span>{isVendor ? "Assigned assets" : "Assets"}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              ) : null}

              {adminNav.catalogSections.length > 0 ? (
                <Collapsible asChild defaultOpen={isCatalogActive} className="group/collapsible">
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton isActive={isCatalogActive} tooltip="Administration">
                        <ShieldCheck />
                        <span>Administration</span>
                        <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {adminNav.catalogSections.map((section) => (
                          <SidebarMenuSubItem key={section.href}>
                            <SidebarMenuSubButton
                              asChild
                              isActive={
                                section.module === "users" || section.module === "roles"
                                  ? isUsersAndRolesActive
                                  : isPathActive(section.href)
                              }
                            >
                              <Link href={section.href}>
                                <span>{section.title}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              ) : null}

              {adminNav.vendors ? (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isPathActive(adminNav.vendors.href)} tooltip="Vendors">
                    <Link href={adminNav.vendors.href}>
                      <Package />
                      <span>Vendors</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ) : null}

              {adminNav.maintenance ? (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isPathActive(adminNav.maintenance.href)} tooltip="Maintenance">
                    <Link href={adminNav.maintenance.href}>
                      <Wrench />
                      <span>Maintenance</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ) : null}

              {adminNav.audits ? (
                <>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={isPathActive("/floor/audits")} tooltip="Floor audit">
                      <Link href="/floor/audits">
                        <QrCode />
                        <span>Floor audit</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={isPathActive(adminNav.audits.href)} tooltip="Audits">
                      <Link href={adminNav.audits.href}>
                        <ScrollText />
                        <span>Audits</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </>
              ) : null}

              {adminNav.reports ? (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isPathActive(adminNav.reports.href)} tooltip="Reports">
                    <Link href={adminNav.reports.href}>
                      <ScrollText />
                      <span>Reports</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ) : null}

              {adminNav.settings ? (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isPathActive(adminNav.settings.href)} tooltip="Settings">
                    <Link href={adminNav.settings.href}>
                      <Settings />
                      <span>Settings</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ) : null}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
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
