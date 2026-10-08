"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function FieldPanels({
  extra,
  builtin,
}: {
  extra: ReactNode | null;
  builtin: ReactNode | null;
}) {
  const [tab, setTab] = useState<"extra" | "builtin">(extra ? "extra" : "builtin");

  if (!extra || !builtin) {
    return <div className="flex flex-col gap-4">{extra ?? builtin}</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <PanelButton active={tab === "extra"} onClick={() => setTab("extra")}>
          Extra fields
        </PanelButton>
        <PanelButton active={tab === "builtin"} onClick={() => setTab("builtin")}>
          Built-in fields
        </PanelButton>
      </div>
      {tab === "extra" ? extra : builtin}
    </div>
  );
}

function PanelButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-4 py-1.5 text-sm font-medium",
        active ? "bg-primary text-primary-foreground" : "bg-white text-slate-600 ring-1 ring-slate-200",
      )}
    >
      {children}
    </button>
  );
}
