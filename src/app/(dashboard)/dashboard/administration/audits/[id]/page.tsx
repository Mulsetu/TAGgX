import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, MapPin } from "lucide-react";
import { assertModule, requireModule } from "@/lib/permissions/features";
import { assertPermission, requirePermission } from "@/lib/permissions/has-permission";
import { AuditProgressBar } from "@/components/audits/audit-progress";
import { StatTiles } from "@/components/layout/stat-tiles";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getAuditDetail, getAuditItemsForDetail, getAuditScanCatalog } from "@/modules/audits/actions";
import { getAssetFormOptionsForForm } from "@/modules/assets/actions";
import { AUDIT_STATUS_LABELS } from "@/modules/audits/types";
import { AuditToolbar } from "./audit-toolbar";
import { AuditItemTable } from "./item-table";

interface AuditDetailPageProps {
  params: { id: string };
  searchParams: Record<string, string | string[] | undefined>;
}

const TABS = ["all", "unverified", "verified", "exceptions"] as const;

const TAB_TITLES: Record<(typeof TABS)[number], string> = {
  all: "All assets",
  unverified: "Left to scan",
  verified: "OK",
  exceptions: "Problems",
};

function tabHref(auditId: string, tab: string, page?: number, exception?: string): string {
  const params = new URLSearchParams();
  if (tab !== "all") params.set("tab", tab);
  if (exception) params.set("exception", exception);
  if (page && page > 1) params.set("page", String(page));
  const query = params.toString();
  return query
    ? `/dashboard/administration/audits/${auditId}?${query}`
    : `/dashboard/administration/audits/${auditId}`;
}

export default async function AuditDetailPage({ params, searchParams }: AuditDetailPageProps) {
  await assertModule("audits");
  await assertPermission("audits", "view");
  const audit = await getAuditDetail(params.id);
  if (!audit) {
    notFound();
  }

  const tabRaw = typeof searchParams.tab === "string" ? searchParams.tab : "all";
  const exceptionRaw = typeof searchParams.exception === "string" ? searchParams.exception : "";
  const tab = TABS.find((entry) => entry === tabRaw) ?? "all";

  const [items, catalog, canEdit, canDelete, maintenanceOn, canCreateTicket, options] = await Promise.all([
    getAuditItemsForDetail(params.id, searchParams),
    getAuditScanCatalog(),
    requirePermission("audits", "edit"),
    requirePermission("audits", "delete"),
    requireModule("maintenance"),
    requirePermission("maintenance", "create"),
    getAssetFormOptionsForForm(),
  ]);
  const canRaiseTicket = maintenanceOn && canCreateTicket;

  const totalPages = Math.max(1, Math.ceil(items.totalCount / items.pageSize));

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/dashboard/administration/audits"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:underline"
      >
        <ChevronLeft className="size-4" /> All audits
      </Link>

      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{audit.name}</h1>
          <Badge variant={audit.status === "active" ? "default" : audit.status === "completed" ? "secondary" : "outline"}>
            {AUDIT_STATUS_LABELS[audit.status]}
          </Badge>
        </div>
        <p className="flex flex-wrap items-center gap-x-1 text-sm text-muted-foreground">
          <MapPin className="size-3.5" />
          {audit.locationName ?? "All locations"} · {audit.scheduledDate}
          {audit.createdByName ? ` · by ${audit.createdByName}` : ""}
        </p>
        {audit.status !== "draft" ? <AuditProgressBar audit={audit} /> : null}
      </header>

      <AuditToolbar audit={audit} canEdit={canEdit} canDelete={canDelete} />

      <StatTiles
        stats={[
          { label: "All assets", value: audit.totalItems, tone: "neutral", href: tabHref(audit.id, "all"), active: tab === "all" },
          { label: "OK", value: audit.verifiedCount, tone: "good", href: tabHref(audit.id, "verified"), active: tab === "verified" },
          {
            label: audit.unresolvedExceptionCount > 0 ? `Problems (${audit.unresolvedExceptionCount} open)` : "Problems",
            value: audit.exceptionCount,
            tone: "bad",
            href: tabHref(audit.id, "exceptions"),
            active: tab === "exceptions",
          },
          { label: "Left to scan", value: audit.unverifiedCount, tone: "pending", href: tabHref(audit.id, "unverified"), active: tab === "unverified" },
        ]}
      />

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-slate-900">
            {TAB_TITLES[tab]} <span className="font-normal text-slate-500">({items.totalCount})</span>
          </h2>
        </div>

        {tab === "exceptions" && catalog.exceptionTypes.length > 0 ? (
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            <Button asChild size="sm" variant={exceptionRaw ? "outline" : "secondary"} className="shrink-0 rounded-full">
              <Link href={tabHref(audit.id, "exceptions")}>Any problem</Link>
            </Button>
            {catalog.exceptionTypes.map((type) => (
              <Button
                key={type.key}
                asChild
                size="sm"
                variant={exceptionRaw === type.key ? "secondary" : "outline"}
                className="shrink-0 rounded-full"
              >
                <Link href={tabHref(audit.id, "exceptions", undefined, exceptionRaw === type.key ? "" : type.key)}>
                  {type.name}
                </Link>
              </Button>
            ))}
          </div>
        ) : null}

        <AuditItemTable
          auditId={audit.id}
          items={items.items}
          canEdit={canEdit}
          auditActive={audit.status === "active"}
          requirePhotoOnException={audit.requirePhotoOnException}
          users={options.users}
          canRaiseTicket={canRaiseTicket}
        />

        {totalPages > 1 ? (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Page {items.page} of {totalPages}
            </span>
            <div className="flex gap-2">
              {items.page > 1 ? (
                <Button asChild variant="outline" className="min-h-11">
                  <Link href={tabHref(audit.id, tab, items.page - 1, exceptionRaw)}>Previous</Link>
                </Button>
              ) : null}
              {items.page < totalPages ? (
                <Button asChild variant="outline" className="min-h-11">
                  <Link href={tabHref(audit.id, tab, items.page + 1, exceptionRaw)}>Next</Link>
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
