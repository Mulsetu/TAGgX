import Link from "next/link";
import {
  ArrowLeftRight,
  Box,
  CreditCard,
  History,
  Settings2,
  UserRound,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { LocalTime } from "@/components/layout/local-time";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { assertPermission } from "@/lib/permissions/has-permission";
import { getAuditLogForAdmin } from "@/modules/activity/actions";
import { ACTIVITY_AREAS, ACTIVITY_AREA_LABELS, type ActivityArea, type AuditLogEntry } from "@/modules/activity/types";
import { SettingsFrame } from "../settings/settings-frame";

interface ActivityPageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

/** Plain-language verb for each recorded action; unknown ones fall back to a readable form of the key. */
const ACTION_TEXT: Record<string, string> = {
  "asset.created": "added an asset",
  "asset.updated": "edited an asset",
  "asset.deleted": "moved an asset to the recycle bin",
  "asset.restored": "restored an asset",
  "asset.disposed": "disposed of an asset",
  "asset.document_deleted": "deleted an asset document",
  "assets.imported": "imported assets from CSV",
  "asset.handover": "handed over an asset",
  "asset.return": "recorded an asset return",
  "asset.transfer": "transferred an asset",
  "asset.transfer_requested": "requested an asset transfer",
  "asset.transfer_accepted": "accepted an asset transfer",
  "asset.transfer_rejected": "rejected an asset transfer",
  "maintenance.created": "opened a maintenance ticket",
  "maintenance_plan.created": "created a maintenance plan",
  "maintenance_plan.updated": "updated a maintenance plan",
  "maintenance_plan.deleted": "deleted a maintenance plan",
  "user.invited": "invited a person",
  "user.role_changed": "changed someone's role",
  "user.activated": "reactivated a person",
  "user.deactivated": "deactivated a person",
  "user.company_admin_transferred": "transferred Company Admin",
  "role.created": "created a role",
  "role.permissions_changed": "changed a role's permissions",
  "settings.updated": "updated workspace settings",
  "email_template.updated": "edited an email template",
  "status.created": "added an asset status",
  "condition.created": "added a condition",
  "condition.updated": "edited a condition",
  "condition.deleted": "deleted a condition",
  "vendor.created": "added a vendor",
  "vendor.updated": "edited a vendor",
  "company.created": "created the workspace",
  "company.data_exported": "exported workspace data",
  "company.deletion_requested": "requested workspace deletion",
  "company.deletion_request_canceled": "cancelled the deletion request",
  "payment.recorded": "recorded a payment",
  "plan.changed": "changed the plan",
  "subscription.activated": "activated the subscription",
  "subscription.extended": "extended the subscription",
};

const AREA_ICON: Record<Exclude<ActivityArea, "all">, LucideIcon> = {
  assets: Box,
  custody: ArrowLeftRight,
  maintenance: Wrench,
  people: UserRound,
  settings: Settings2,
  billing: CreditCard,
};

function describe(action: string): string {
  return ACTION_TEXT[action] ?? action.replace(/[._]/g, " ");
}

function iconFor(action: string): LucideIcon {
  if (/^asset\.(handover|return|transfer)/.test(action)) return AREA_ICON.custody;
  if (action.startsWith("asset")) return AREA_ICON.assets;
  if (action.startsWith("maintenance")) return AREA_ICON.maintenance;
  if (action.startsWith("user.") || action.startsWith("role.")) return AREA_ICON.people;
  if (/^(payment|plan|subscription)\./.test(action)) return AREA_ICON.billing;
  return AREA_ICON.settings;
}

/** Day headings in IST, matching how most workspaces read the log. */
function dayKey(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(iso));
}

function dayLabel(key: string): string {
  const today = dayKey(new Date().toISOString());
  const yesterday = dayKey(new Date(Date.now() - 86_400_000).toISOString());
  if (key === today) return "Today";
  if (key === yesterday) return "Yesterday";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${key}T00:00:00Z`),
  );
}

function listHref(area: ActivityArea, page?: number): string {
  const params = new URLSearchParams();
  if (area !== "all") params.set("area", area);
  if (page && page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/dashboard/administration/activity?${query}` : "/dashboard/administration/activity";
}

function Entry({ entry }: { entry: AuditLogEntry }) {
  const Icon = iconFor(entry.action);
  const assetLink = entry.entityType === "asset" && entry.entityId ? `/assets/${entry.entityId}` : null;
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-slate-800">
          <span className="font-medium text-slate-900">{entry.actorName ?? "System"}</span> {describe(entry.action)}
          {assetLink ? (
            <>
              {" · "}
              <Link href={assetLink} className="text-[hsl(var(--brand-primary))] hover:underline">
                view asset
              </Link>
            </>
          ) : null}
        </p>
      </div>
      <LocalTime iso={entry.createdAt} mode="time" className="shrink-0 text-xs text-slate-500" />
    </li>
  );
}

export default async function ActivityPage({ searchParams }: ActivityPageProps) {
  await assertPermission("settings", "view");
  const log = await getAuditLogForAdmin(searchParams);
  const totalPages = Math.max(1, Math.ceil(log.totalCount / log.pageSize));

  const days: { key: string; entries: AuditLogEntry[] }[] = [];
  for (const entry of log.items) {
    const key = dayKey(entry.createdAt);
    const last = days[days.length - 1];
    if (last?.key === key) last.entries.push(entry);
    else days.push({ key, entries: [entry] });
  }

  return (
    <SettingsFrame>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold text-slate-900">Activity</h2>
          <p className="text-sm text-slate-500">Who changed what in this workspace, newest first.</p>
        </div>

        <nav className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" aria-label="Filter activity">
          {ACTIVITY_AREAS.map((area) => (
            <Link
              key={area}
              href={listHref(area)}
              aria-current={log.area === area ? "page" : undefined}
              className={cn(
                "shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                log.area === area
                  ? "bg-primary text-primary-foreground"
                  : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50",
              )}
            >
              {ACTIVITY_AREA_LABELS[area]}
            </Link>
          ))}
        </nav>

        {days.length === 0 ? (
          <p className="flex items-center gap-2 rounded-xl border border-dashed bg-white p-6 text-sm text-slate-500">
            <History className="size-4" /> Nothing recorded here yet.
          </p>
        ) : (
          days.map((day) => (
            <section key={day.key} className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">{dayLabel(day.key)}</h3>
              <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
                {day.entries.map((entry) => (
                  <Entry key={entry.id} entry={entry} />
                ))}
              </ul>
            </section>
          ))
        )}

        {totalPages > 1 ? (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Page {log.page} of {totalPages}
            </span>
            <div className="flex gap-2">
              {log.page > 1 ? (
                <Button asChild variant="outline" className="min-h-11">
                  <Link href={listHref(log.area, log.page - 1)}>Newer</Link>
                </Button>
              ) : null}
              {log.page < totalPages ? (
                <Button asChild variant="outline" className="min-h-11">
                  <Link href={listHref(log.area, log.page + 1)}>Older</Link>
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </SettingsFrame>
  );
}
