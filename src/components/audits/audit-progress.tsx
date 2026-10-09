import Link from "next/link";
import { cn } from "@/lib/utils";

interface AuditCounts {
  totalItems: number;
  verifiedCount: number;
  exceptionCount: number;
  unverifiedCount: number;
  progressPercent: number;
}

/** "12 of 40 checked" + bar — one consistent progress readout for every audit screen. */
export function AuditProgressBar({ audit, className }: { audit: AuditCounts; className?: string }) {
  const checked = audit.totalItems - audit.unverifiedCount;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium text-slate-900">
          {checked} of {audit.totalItems} checked
        </span>
        <span className="text-slate-500">{audit.progressPercent}%</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${audit.progressPercent}%` }} />
      </div>
    </div>
  );
}

const TONES = {
  neutral: "text-slate-900",
  good: "text-emerald-700",
  bad: "text-red-600",
  pending: "text-amber-700",
} as const;

export interface AuditStat {
  label: string;
  value: number;
  tone: keyof typeof TONES;
  href?: string;
  active?: boolean;
}

/** Tappable count tiles; when `href` is set they double as the list filter. */
export function AuditStatTiles({ stats }: { stats: AuditStat[] }) {
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
