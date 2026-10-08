import Link from "next/link";
import { notFound } from "next/navigation";
import { AuditScanForm } from "@/components/audits/audit-scan-form";
import { Badge } from "@/components/ui/badge";
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

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4">
      <Link href="/floor/audits" className="text-sm text-slate-500 hover:underline">
        ← Active campaigns
      </Link>

      <header className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">{audit.name}</h1>
          <Badge variant={audit.status === "active" ? "default" : audit.status === "completed" ? "secondary" : "outline"}>
            {AUDIT_STATUS_LABELS[audit.status]}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          {audit.scheduledDate} · {audit.locationName ?? "All locations"}
        </p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full bg-primary" style={{ width: `${audit.progressPercent}%` }} />
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {audit.progressPercent}% · {audit.verifiedCount} verified · {audit.unverifiedCount} left
        </p>
      </header>

      {audit.status === "draft" ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          <p>Start this campaign before walking the floor.</p>
          <Link href={`/dashboard/administration/audits/${audit.id}`} className="mt-2 inline-block text-[hsl(var(--brand-primary))] hover:underline">
            Open the campaign
          </Link>
        </div>
      ) : null}

      {audit.status === "completed" ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          <p>
            This walk is finished. {audit.verifiedCount} verified, {audit.exceptionCount} exceptions.
          </p>
          <Link href={`/dashboard/administration/audits/${audit.id}`} className="mt-2 inline-block text-[hsl(var(--brand-primary))] hover:underline">
            Review the results
          </Link>
        </div>
      ) : null}

      {audit.status === "active" && canEdit ? (
        <AuditScanForm
          auditId={audit.id}
          locations={locations}
          conditions={catalog.conditions}
          exceptionTypes={catalog.exceptionTypes}
        />
      ) : null}

      {audit.status === "active" && !canEdit ? (
        <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          You can follow this walk, but your role can&apos;t record scans.
        </p>
      ) : null}

      {remaining ? (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900">Still to scan</h2>
          {remaining.items.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">Every asset in this campaign has been checked.</p>
          ) : (
            <ul className="mt-2 divide-y divide-slate-100">
              {remaining.items.map((item) => (
                <li key={item.id} className="py-2">
                  <p className="text-sm font-medium text-slate-900">{item.assetName}</p>
                  <p className="text-xs text-slate-500">
                    {item.assetCode}
                    {item.expectedLocationName ? ` · ${item.expectedLocationName}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {remaining.totalCount > remaining.items.length ? (
            <p className="mt-2 text-xs text-slate-500">{remaining.totalCount - remaining.items.length} more on the campaign page.</p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
