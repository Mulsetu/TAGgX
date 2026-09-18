import * as React from "react";
import { cn } from "@/lib/utils";

// A plain native <select>, not @radix-ui/react-select: Radix's Select
// renders a button + listbox rather than a real <select>, so it doesn't
// participate in native FormData submission. This form has too many
// dropdown fields to make each one controlled state just to work around
// that — a native element with matching styling is simpler here.
const NativeSelect = React.forwardRef<HTMLSelectElement, React.ComponentProps<"select">>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "flex h-11 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:h-9 md:text-sm",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  ),
);
NativeSelect.displayName = "NativeSelect";

export { NativeSelect };
