"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export interface SectionTab {
  title: string;
  href: string;
}

/** Header-navbar for a sidebar entry that groups two or more closely related pages. */
export function SectionTabs({ tabs }: { tabs: SectionTab[] }) {
  const pathname = usePathname();

  if (tabs.length < 2) {
    return null;
  }

  return (
    <nav className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href || pathname.startsWith(`${tab.href}/`);

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50",
            )}
          >
            {tab.title}
          </Link>
        );
      })}
    </nav>
  );
}
