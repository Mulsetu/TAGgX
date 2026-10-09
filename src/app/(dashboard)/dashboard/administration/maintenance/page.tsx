import Link from "next/link";
import { QrCode } from "lucide-react";
import { StatTiles } from "@/components/layout/stat-tiles";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { assertModule } from "@/lib/permissions/features";
import { assertPermission, requirePermission } from "@/lib/permissions/has-permission";
import {
  getMaintenanceTicketCounts,
  getMaintenanceTicketsForAdmin,
  getMaintenanceTypesForForm,
} from "@/modules/maintenance/actions";
import { getAssetFormOptionsForForm } from "@/modules/assets/actions";
import { getVendorOptions } from "@/modules/vendors/actions";
import type { TicketView } from "@/modules/maintenance/types";
import { CreateTicketForm } from "./create-ticket-form";
import { TicketList } from "./ticket-list";

interface MaintenancePageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

const VIEWS: { id: TicketView; label: string }[] = [
  { id: "open", label: "Open" },
  { id: "in_progress", label: "In progress" },
  { id: "resolved", label: "Closed" },
  { id: "all", label: "All" },
];

function listHref(view: TicketView, qrOnly: boolean, page?: number): string {
  const params = new URLSearchParams();
  if (view !== "open") params.set("view", view);
  if (qrOnly) params.set("source", "qr");
  if (page && page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/dashboard/administration/maintenance?${query}` : "/dashboard/administration/maintenance";
}

export default async function MaintenancePage({ searchParams }: MaintenancePageProps) {
  await assertModule("maintenance");
  await assertPermission("maintenance", "view");
  const [list, counts, options, vendors, types, canCreate] = await Promise.all([
    getMaintenanceTicketsForAdmin(searchParams),
    getMaintenanceTicketCounts(),
    getAssetFormOptionsForForm(),
    getVendorOptions(),
    getMaintenanceTypesForForm(),
    requirePermission("maintenance", "create"),
  ]);

  const totalPages = Math.max(1, Math.ceil(list.totalCount / list.pageSize));
  const viewLabel = VIEWS.find((entry) => entry.id === list.view)?.label ?? "Open";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Maintenance</h1>
          <p className="text-sm text-muted-foreground">
            Repair and service tickets — raised by your team or reported by anyone scanning an asset&apos;s QR tag.
          </p>
        </div>
        {canCreate ? (
          <CreateTicketForm assets={options.linkableAssets} vendors={vendors} types={types} />
        ) : null}
      </div>

      <StatTiles
        stats={[
          { label: "Open", value: counts.open, tone: "pending", href: listHref("open", false), active: list.view === "open" && !list.qrOnly },
          {
            label: "In progress",
            value: counts.inProgress,
            tone: "neutral",
            href: listHref("in_progress", false),
            active: list.view === "in_progress" && !list.qrOnly,
          },
          { label: "Overdue", value: counts.overdue, tone: "bad" },
          {
            label: "New QR reports",
            value: counts.qrOpen,
            tone: counts.qrOpen > 0 ? "pending" : "neutral",
            href: listHref("open", true),
            active: list.qrOnly,
          },
        ]}
      />

      <div className="flex flex-col gap-3">
        <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1">
          {VIEWS.map((entry) => (
            <Link
              key={entry.id}
              href={listHref(entry.id, list.qrOnly)}
              aria-current={list.view === entry.id ? "page" : undefined}
              className={cn(
                "shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                list.view === entry.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50",
              )}
            >
              {entry.label}
            </Link>
          ))}
          <span className="mx-1 h-6 w-px shrink-0 bg-slate-200" aria-hidden />
          <Link
            href={listHref(list.view, !list.qrOnly)}
            aria-pressed={list.qrOnly}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
              list.qrOnly
                ? "bg-amber-100 text-amber-900 ring-1 ring-amber-300"
                : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50",
            )}
          >
            <QrCode className="size-3.5" />
            QR reports only
          </Link>
        </div>

        <h2 className="text-base font-semibold text-slate-900">
          {list.qrOnly ? `${viewLabel} QR reports` : `${viewLabel} tickets`}{" "}
          <span className="font-normal text-slate-500">({list.totalCount})</span>
        </h2>

        <TicketList
          tickets={list.items}
          users={options.users}
          emptyText={
            list.qrOnly
              ? "No QR reports here. Reports sent from an asset's public QR page appear in this list."
              : "No tickets here."
          }
        />

        {totalPages > 1 ? (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Page {list.page} of {totalPages}
            </span>
            <div className="flex gap-2">
              {list.page > 1 ? (
                <Button asChild variant="outline" className="min-h-11">
                  <Link href={listHref(list.view, list.qrOnly, list.page - 1)}>Previous</Link>
                </Button>
              ) : null}
              {list.page < totalPages ? (
                <Button asChild variant="outline" className="min-h-11">
                  <Link href={listHref(list.view, list.qrOnly, list.page + 1)}>Next</Link>
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
