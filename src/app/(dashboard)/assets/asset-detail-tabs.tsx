"use client";

import { useState, type ReactNode } from "react";

export interface AssetDetailTab {
  id: string;
  label: string;
  content: ReactNode;
}

export function AssetDetailTabs({ tabs }: { tabs: AssetDetailTab[] }) {
  const [active, setActive] = useState(tabs[0]?.id ?? "");
  const current = tabs.find((tab) => tab.id === active) ?? tabs[0];

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex gap-1 overflow-x-auto border-b border-slate-100 px-2">
        {tabs.map((tab) => {
          const selected = tab.id === current?.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActive(tab.id)}
              className={`shrink-0 border-b-2 px-3 py-3 text-sm font-medium ${
                selected
                  ? "border-[hsl(var(--brand-primary))] text-[hsl(var(--brand-primary))]"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <div className="p-4 md:p-5">{current?.content}</div>
    </section>
  );
}
