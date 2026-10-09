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
