"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, Loader2 } from "lucide-react";
import { DASHBOARD_PERIODS, DASHBOARD_PERIOD_LABELS, type DashboardPeriod } from "@/modules/reports/types";

/** Dashboard period filter — kept in the URL (?period=) so it survives refresh and can be shared. */
export function PeriodSelect({ value }: { value: DashboardPeriod }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function change(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "all") params.delete("period");
    else params.set("period", next);
    const query = params.toString();
    startTransition(() => router.push(query ? `${pathname}?${query}` : pathname, { scroll: false }));
  }

  return (
    <label className="relative inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white pl-3 pr-2 text-sm text-slate-600 shadow-sm">
      {isPending ? (
        <Loader2 className="size-4 animate-spin text-slate-400" />
      ) : (
        <CalendarDays className="size-4 text-slate-400" />
      )}
      <span className="sr-only">Period</span>
      <select
        value={value}
        onChange={(event) => change(event.target.value)}
        className="cursor-pointer bg-transparent pr-1 font-medium text-slate-700 outline-none"
      >
        {DASHBOARD_PERIODS.map((period) => (
          <option key={period} value={period}>
            {DASHBOARD_PERIOD_LABELS[period]}
          </option>
        ))}
      </select>
    </label>
  );
}
