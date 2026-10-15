import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = ["Account", "Verify email", "Workspace", "Card payment"] as const;

/** Progress for the self-serve signup: /signup → check-email → /onboarding → Razorpay. */
export function SignupSteps({ current }: { current: 1 | 2 | 3 | 4 }) {
  return (
    <ol className="flex items-center gap-2 text-xs" aria-label="Signup progress">
      {STEPS.map((label, index) => {
        const step = index + 1;
        const done = step < current;
        const active = step === current;
        return (
          <li key={label} className="flex min-w-0 flex-1 items-center gap-2" aria-current={active ? "step" : undefined}>
            <span
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold",
                done && "border-[#3F7A22] bg-[#3F7A22] text-white",
                active && "border-[#005068] bg-[#005068] text-white",
                !done && !active && "border-[#005068]/20 text-[#003848]/50",
              )}
            >
              {done ? <Check className="size-3.5" aria-hidden /> : step}
            </span>
            <span className={cn("hidden truncate sm:inline", active ? "font-semibold text-[#003848]" : "text-[#003848]/55")}>
              {label}
            </span>
            {step < STEPS.length ? <span className="h-px flex-1 bg-[#005068]/15" aria-hidden /> : null}
          </li>
        );
      })}
    </ol>
  );
}
