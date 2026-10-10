import { SidebarTrigger } from "@/components/ui/sidebar";
import { TagXLogo } from "./brand-logo";
import { SignOutButton } from "./sign-out-button";

export function TopBar() {
  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4">
      <SidebarTrigger className="size-10 text-slate-600 md:size-8" />
      <div className="flex-1" />
      {/* Mobile only — on desktop, sign out lives in the sidebar's user menu. */}
      <SignOutButton variant="icon" from="tenant" />
      <TagXLogo size={32} className="h-8 w-auto max-w-[7.5rem] object-contain" />
    </header>
  );
}
