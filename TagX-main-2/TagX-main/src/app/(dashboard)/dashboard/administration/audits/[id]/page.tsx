import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/permissions/has-permission";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getAuditDetail, getAuditItemsForDetail, getAuditLocationsForForm } from "@/modules/audits/actions";
import { AUDIT_STATUS_LABELS } from "@/modules/audits/types";
import { AuditToolbar } from "./audit-toolbar";
import { AuditItemTable } from "./item-table";
import { AuditScanForm } from "./scan-form";

interface AuditDetailPageProps {
  params: { id: string };
  searchParams: Record<string, string | string[] | undefined>;
}

const TABS = [
  { id: "all", label: "All" },
  { id: "unverified", label: "Unverified" },
  { id: "verified", label: "Verified" },
  { id: "exceptions", label: "Exceptions" },
] as const;

function tabHref(auditId: string, tab: string, page?: number): string {
  const params = new URLSearchParams();
  if (tab !== "all") params.set("tab", tab);
  if (page && page > 1) params.set("page", String(page));
  const query = params.toString();
  return query
    ? `/dashboard/administration/audits/${auditId}?${query}`
    : `/dashboard/administration/audits/${auditId}`;
}

export default async function AuditDetailPage({ params, searchParams }: AuditDetailPageProps) {
  const audit = await getAuditDetail(params.id);
  if (!audit) {
    notFound();
  }

  const tabRaw = typeof searchParams.tab === "string" ? searchParams.tab : "all";
  const tab = TABS.some((entry) => entry.id === tabRaw) ? tabRaw : "all";

  const [items, locations, canEdit, canDelete] = await Promise.all([
    getAuditItemsForDetail(params.id, searchParams),
    getAuditLocationsForForm(),
    requirePermission("audits", "edit"),
    requirePermission("audits", "delete"),
  ]);

  const totalPages = Math.max(1, Math.ceil(items.totalCount / items.pageSize));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link href="/dashboard/administration/audits" className="text-sm text-muted-foreground hover:underline">
          ← All audits
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{audit.name}</h1>
              <Badge variant={audit.status === "active" ? "default" : audit.status === "completed" ? "secondary" : "outline"}>
                {AUDIT_STATUS_LABELS[audit.status]}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {audit.scheduledDate} · {audit.locationName ?? "All locations"}
              {audit.createdByName ? ` · Created by ${audit.createdByName}` : ""}
            </p>
          </div>
          <AuditToolbar audit={audit} canEdit={canEdit} canDelete={canDelete} />
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-lg border p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Progress</span>
          <span className="text-muted-foreground">
            {audit.progressPercent}% complete · {audit.verifiedCount} verified · {audit.exceptionCount}{" "}
            exceptions · {audit.unverifiedCount} unverified
            {audit.unresolvedExceptionCount > 0 ? ` · ${audit.unresolvedExceptionCount} unresolved` : ""}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary" style={{ width: `${audit.progressPercent}%` }} />
        </div>
        <p className="text-xs text-muted-foreground">
          Started {audit.startedAt ? new Date(audit.startedAt).toLocaleString("en-US") : "—"}
          {" · "}
          Completed {audit.completedAt ? new Date(audit.completedAt).toLocaleString("en-US") : "—"}
        </p>
      </div>

      {audit.status === "active" && canEdit ? <AuditScanForm auditId={audit.id} locations={locations} /> : null}

      {audit.status === "draft" ? (
        <p className="text-sm text-muted-foreground">Start this audit to scan QR tags and record verifications.</p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {TABS.map((entry) => (
          <Button key={entry.id} asChild variant={tab === entry.id ? "default" : "outline"} size="sm">
            <Link href={tabHref(audit.id, entry.id)}>{entry.label}</Link>
          </Button>
        ))}
      </div>

      <AuditItemTable
        auditId={audit.id}
        items={items.items}
        canEdit={canEdit}
        auditActive={audit.status === "active"}
      />

      {totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {items.page} of {totalPages}
          </span>
          <div className="flex gap-2">
            {items.page > 1 ? (
              <Button asChild variant="outline" size="sm">
                <Link href={tabHref(audit.id, tab, items.page - 1)}>Previous</Link>
              </Button>
            ) : null}
            {items.page < totalPages ? (
              <Button asChild variant="outline" size="sm">
                <Link href={tabHref(audit.id, tab, items.page + 1)}>Next</Link>
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
