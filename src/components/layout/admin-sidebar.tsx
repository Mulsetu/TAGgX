"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";
import {
  Building2,
  CreditCard,
  HardDrive,
  Inbox,
  Package,
  Receipt,
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
  SidebarRail,
} from "@/components/ui/sidebar";
import { TagXLogo } from "./brand-logo";
import { UserMenu } from "./user-menu";
import type { CurrentUser } from "@/modules/users/types";

const NAV = [
  { href: "/admin", label: "Companies", icon: Building2, exact: true },
  { href: "/admin/leads", label: "Leads", icon: Inbox, exact: false },
  { href: "/admin/plans", label: "Plans", icon: CreditCard, exact: false },
  { href: "/admin/orders", label: "Asset orders", icon: Package, exact: false },
  { href: "/admin/payments", label: "Payments", icon: Receipt, exact: false },
  { href: "/admin/storage", label: "Storage usage", icon: HardDrive, exact: false },
] as const;

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
    if (pathname === href) return;
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

export function AdminSidebar({ email }: { email: string }) {
  const pathname = usePathname();
  const account: CurrentUser = {
    id: "platform-admin",
    email,
    fullName: "Platform admin",
    companyId: null,
    vendorId: null,
    isCompanyAdmin: false,
    role: { id: "platform", name: "Super admin" },
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-16 shrink-0 justify-center border-b border-slate-200 bg-white px-4 group-data-[collapsible=icon]:px-2">
        <Link href="/admin" className="flex h-full items-center group-data-[collapsible=icon]:justify-center">
          <TagXLogo
            size={40}
            className="h-9 w-auto max-w-[11rem] object-contain group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8"
          />
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map((item) => {
                const Icon = item.icon;
                const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <SidebarLink
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    icon={<Icon />}
                    active={active}
                  />
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-white/10">
        <SidebarMenu>
          <SidebarMenuItem>
            <UserMenu user={account} from="admin" />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
