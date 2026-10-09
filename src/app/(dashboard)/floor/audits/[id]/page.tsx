import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, MapPin } from "lucide-react";
import { AuditProgressBar } from "@/components/audits/audit-progress";
import { AuditScanForm } from "@/components/audits/audit-scan-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requirePermission } from "@/lib/permissions/has-permission";
import {
  getAuditDetail,
  getAuditItemsForDetail,
  getAuditLocationsForForm,
  getAuditScanCatalog,
} from "@/modules/audits/actions";
import { AUDIT_STATUS_LABELS } from "@/modules/audits/types";

interface FloorAuditWalkPageProps {
  params: { id: string };
}

export default async function FloorAuditWalkPage({ params }: FloorAuditWalkPageProps) {
  const audit = await getAuditDetail(params.id);
  if (!audit) {
    notFound();
  }

  const [locations, catalog, canEdit, remaining] = await Promise.all([
    getAuditLocationsForForm(),
    getAuditScanCatalog(),
    requirePermission("audits", "edit"),
    audit.status === "active" ? getAuditItemsForDetail(params.id, { tab: "unverified" }) : Promise.resolve(null),
  ]);

  const detailHref = `/dashboard/administration/audits/${audit.id}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-2 text-sm">
        <Link href="/dashboard/administration/audits" className="flex items-center gap-1 text-slate-500 hover:underline">
          <ChevronLeft className="size-4" /> All audits
        </Link>
        <Link href={detailHref} className="text-[hsl(var(--brand-primary))] hover:underline">
          Full results
        </Link>
      </div>

      <header className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight text-slate-900">{audit.name}</h1>
            <p className="flex items-center gap-1 text-sm text-slate-500">
              <MapPin className="size-3.5 shrink-0" />
              {audit.locationName ?? "All locations"}
            </p>
          </div>
          <Badge variant={audit.status === "active" ? "default" : audit.status === "completed" ? "secondary" : "outline"}>
            {AUDIT_STATUS_LABELS[audit.status]}
          </Badge>
        </div>
        <AuditProgressBar audit={audit} />
        <p className="text-xs text-slate-500">
          <span className="text-emerald-700">{audit.verifiedCount} OK</span>
          {" · "}
          <span className="text-red-600">{audit.exceptionCount} with problems</span>
          {" · "}
          {audit.unverifiedCount} left
        </p>
      </header>

      {audit.status === "draft" ? (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          <p>This audit hasn&apos;t started yet. Start it before scanning.</p>
          <Button asChild>
            <Link href={detailHref}>Open audit to start it</Link>
          </Button>
        </div>
      ) : null}

      {audit.status === "completed" ? (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          <p>This audit is finished: {audit.verifiedCount} OK, {audit.exceptionCount} with problems.</p>
          <Button asChild variant="outline">
            <Link href={detailHref}>See results</Link>
          </Button>
        </div>
      ) : null}

      {audit.status === "active" ? (
        <div className="grid grid-cols-1 items-start gap-4 @4xl:grid-cols-[minmax(0,1fr)_22rem]">
          {canEdit ? (
            <AuditScanForm
              auditId={audit.id}
              locations={locations}
              conditions={catalog.conditions}
              exceptionTypes={catalog.exceptionTypes}
              requireRemarkOnException={audit.requireRemarkOnException}
              requirePhotoOnException={audit.requirePhotoOnException}
            />
          ) : (
            <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
              You can follow progress here, but your role can&apos;t record scans.
            </p>
          )}

          {remaining ? (
            <details open className="group rounded-xl border border-slate-200 bg-white p-4">
              <summary className="flex cursor-pointer select-none items-center justify-between text-sm font-semibold text-slate-900">
                Still to scan ({remaining.totalCount})
                <span className="text-xs font-normal text-slate-500 group-open:hidden">Show</span>
              </summary>
              {remaining.items.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">Everything has been scanned. You can complete the audit.</p>
              ) : (
                <ul className="mt-2 max-h-[28rem] divide-y divide-slate-100 overflow-y-auto">
                  {remaining.items.map((item) => (
                    <li key={item.id} className="py-2">
                      <p className="truncate text-sm font-medium text-slate-900">{item.assetName}</p>
                      <p className="truncate text-xs text-slate-500">
                        {item.assetCode}
                        {item.expectedLocationName ? ` · ${item.expectedLocationName}` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              {remaining.totalCount > remaining.items.length ? (
                <Link href={`${detailHref}?tab=unverified`} className="mt-2 inline-block text-xs text-slate-500 hover:underline">
                  + {remaining.totalCount - remaining.items.length} more — view all
                </Link>
              ) : null}
            </details>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
