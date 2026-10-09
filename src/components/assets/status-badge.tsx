import { cn } from "@/lib/utils";
import { parseHexColor } from "@/lib/color";

/** Name-based fallback for statuses/conditions without a colour of their own. */
function fallbackClass(name: string): string {
  const value = name.toLowerCase();
  if (value.includes("active") || value.includes("good") || value.includes("new")) return "bg-emerald-50 text-emerald-700";
  if (value.includes("missing") || value.includes("lost")) return "bg-sky-50 text-sky-700";
  if (value.includes("repair") || value.includes("maint")) return "bg-violet-50 text-violet-700";
  if (value.includes("unassign") || value.includes("fair")) return "bg-amber-50 text-amber-700";
  if (value.includes("dispos") || value.includes("retir") || value.includes("poor")) return "bg-rose-50 text-rose-700";
  return "bg-slate-100 text-slate-600";
}

/**
 * The one badge for asset statuses and conditions. Uses the colour chosen in
 * Company setup when there is one (tinted background, coloured dot + text),
 * otherwise falls back to a colour guessed from the name.
 */
export function StatusBadge({ name, color, className }: { name: string; color?: string | null; className?: string }) {
  const rgb = color ? parseHexColor(color) : null;
  const label = name.replace(/_/g, " ").replace(/^\w/, (char) => char.toUpperCase());

  if (!rgb) {
    return (
      <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium", fallbackClass(name), className)}>
        <span className="size-1.5 rounded-full bg-current" />
        {label}
      </span>
    );
  }

  return (
    <span
      className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium", className)}
      style={{
        backgroundColor: `rgb(${rgb.r} ${rgb.g} ${rgb.b} / 0.12)`,
        // Darken toward black so light picks stay readable on the tint.
        color: `rgb(${Math.round(rgb.r * 0.7)} ${Math.round(rgb.g * 0.7)} ${Math.round(rgb.b * 0.7)})`,
      }}
    >
      <span className="size-1.5 rounded-full" style={{ backgroundColor: color ?? undefined }} />
      {label}
    </span>
  );
}
