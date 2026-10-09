import Link from "next/link";
import { cn } from "@/lib/utils";

const TONES = {
  neutral: "text-slate-900",
  good: "text-emerald-700",
  bad: "text-red-600",
  pending: "text-amber-700",
} as const;

export interface Stat {
  label: string;
  value: number;
  tone: keyof typeof TONES;
  href?: string;
  active?: boolean;
}

/** Tappable count tiles; when `href` is set they double as the list filter. */
export function StatTiles({ stats }: { stats: Stat[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 @xl:grid-cols-4">
      {stats.map((stat) => {
        const body = (
          <>
            <span className={cn("text-2xl font-semibold tabular-nums", TONES[stat.tone])}>{stat.value}</span>
            <span className="text-xs text-slate-500">{stat.label}</span>
          </>
        );
        const className = cn(
          "flex flex-col rounded-xl border bg-white px-4 py-3",
          stat.active ? "border-primary ring-2 ring-primary/30" : "border-slate-200",
          stat.href && "transition-colors hover:bg-slate-50",
        );
        return stat.href ? (
          <Link key={stat.label} href={stat.href} className={className} aria-current={stat.active ? "true" : undefined}>
            {body}
          </Link>
        ) : (
          <div key={stat.label} className={className}>
            {body}
          </div>
        );
      })}
    </div>
  );
}
