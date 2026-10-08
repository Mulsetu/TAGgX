"use client";

import { useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

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
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  return (
    <Button
      type="submit"
      className={className}
      size={size}
      disabled={busy}
      aria-busy={busy}
      onClick={(event) => {
        if (busyRef.current) {
          event.preventDefault();
          return;
        }
        const form = event.currentTarget.form;
        if (form && !form.checkValidity()) {
          return;
        }
        busyRef.current = true;
        // Disable on the next turn. Disabling inside this click cancels the
        // form submit, so the sign-in action never runs.
        window.setTimeout(() => setBusy(true), 0);
      }}
    >
      {busy ? (
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
