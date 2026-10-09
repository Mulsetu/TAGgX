"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Submit button that shows a spinner only while its form's action is
 * actually running. Driven by useFormStatus, so it resets on its own when
 * the action finishes — including when sign-in fails and redirects back to
 * the same page with ?error=…, where a click-set local flag used to stay
 * stuck on "Signing in..." forever. Disabled while pending, which also
 * blocks double submits.
 */
export function PendingSubmitButton({
  idle,
  pending,
  className,
  size = "touch",
}: {
  idle: string;
  pending: string;
  className?: string;
  size?: "default" | "sm" | "lg" | "icon" | "touch";
}) {
  const { pending: isPending } = useFormStatus();

  return (
    <Button type="submit" className={className} size={size} disabled={isPending} aria-busy={isPending}>
      {isPending ? (
        <>
          <Loader2 className="animate-spin" />
          {pending}
        </>
      ) : (
        idle
      )}
    </Button>
  );
}
