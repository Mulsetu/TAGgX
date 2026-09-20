"use client";

import { ChevronsUpDown } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { SignOutButton } from "@/components/layout/sign-out-button";
import type { CurrentUser } from "@/modules/users/types";

function initialsFor(user: CurrentUser) {
  const source = user.fullName ?? user.email;
  return source.slice(0, 2).toUpperCase();
}

/** Rendered in AppSidebar's footer — the account menu lives bottom-left, not the top header. */
export function UserMenu({ user, from }: { user: CurrentUser; from: "admin" | "tenant" }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton size="lg" tooltip={user.fullName ?? user.email}>
          <Avatar className="h-7 w-7">
            <AvatarFallback>{initialsFor(user)}</AvatarFallback>
          </Avatar>
          <span className="flex min-w-0 flex-col text-left">
            <span className="truncate text-sm font-medium">{user.fullName ?? user.email}</span>
            {user.role ? <span className="truncate text-xs text-muted-foreground">{user.role.name}</span> : null}
          </span>
          <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-56">
        <DropdownMenuLabel className="flex flex-col gap-0.5 font-normal">
          <span className="truncate text-sm font-medium">{user.fullName ?? user.email}</span>
          <span className="truncate text-xs text-muted-foreground">{user.email}</span>
          {user.role ? (
            <span className="truncate text-xs text-muted-foreground">{user.role.name}</span>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <SignOutButton from={from} />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
