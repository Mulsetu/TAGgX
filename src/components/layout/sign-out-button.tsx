"use client";

import { useTransition } from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/modules/users/actions";

export function SignOutButton({
  variant = "menu",
  from,
}: {
  variant?: "menu" | "ghost";
  from: "admin" | "tenant";
}) {
  const [isPending, startTransition] = useTransition();

  function handleSignOut() {
    startTransition(async () => {
      const { redirectPath } = await signOutAction(from);
      window.location.assign(redirectPath);
    });
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
