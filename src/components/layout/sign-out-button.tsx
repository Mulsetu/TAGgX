"use client";

import { useTransition } from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/modules/users/actions";

export function SignOutButton({
  variant = "menu",
  from,
}: {
  variant?: "menu" | "ghost" | "icon";
  from: "admin" | "tenant";
}) {
  const [isPending, startTransition] = useTransition();

  function handleSignOut() {
    startTransition(async () => {
      const { redirectPath } = await signOutAction(from);
      window.location.assign(redirectPath);
    });
  }

  if (variant === "icon") {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-10 rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 md:hidden"
        onClick={handleSignOut}
        disabled={isPending}
      >
        <LogOut className="h-4 w-4" />
        <span className="sr-only">{isPending ? "Signing out..." : "Sign out"}</span>
      </Button>
    );
  }

  if (variant === "ghost") {
    return (
      <Button type="button" variant="ghost" className="h-11 px-3" onClick={handleSignOut} disabled={isPending}>
        {isPending ? "Signing out..." : "Sign out"}
      </Button>
    );
  }

  return (
    <button
      type="button"
      className="flex w-full items-center gap-2"
      onClick={handleSignOut}
      disabled={isPending}
    >
      <LogOut className="size-4" />
      {isPending ? "Signing out..." : "Sign out"}
    </button>
  );
}
