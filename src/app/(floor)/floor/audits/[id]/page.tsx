import Link from "next/link";
import { notFound } from "next/navigation";
import { AuditScanForm } from "@/components/audits/audit-scan-form";
import { getAuditDetail, getAuditLocationsForForm, getAuditScanCatalog } from "@/modules/audits/actions";
import { AUDIT_STATUS_LABELS } from "@/modules/audits/types";

interface FloorAuditPageProps {
  params: { id: string };
}

export default async function FloorAuditPage({ params }: FloorAuditPageProps) {
  const [audit, locations, catalog] = await Promise.all([
    getAuditDetail(params.id),
    getAuditLocationsForForm(),
    getAuditScanCatalog(),
  ]);

  if (!audit) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-4">
      <Link href="/floor/audits" className="text-sm text-muted-foreground hover:underline">
        ← All floor audits
      </Link>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{audit.name}</h1>
        <p className="text-sm text-muted-foreground">
          {AUDIT_STATUS_LABELS[audit.status]} · {audit.locationName ?? "All locations"}
        </p>
      </div>
      <div className="rounded-xl border p-4">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium">Progress</span>
          <span className="text-muted-foreground">{audit.progressPercent}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary" style={{ width: `${audit.progressPercent}%` }} />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {audit.verifiedCount} verified · {audit.exceptionCount} exceptions · {audit.unverifiedCount}{" "}
          still to find
        </p>
      </div>
      {audit.status === "active" ? (
        <AuditScanForm
          auditId={audit.id}
          locations={locations}
          conditions={catalog.conditions}
          exceptionTypes={catalog.exceptionTypes}
        />
      ) : (
        <p className="rounded-lg border p-4 text-sm text-muted-foreground">
          This campaign is not active yet. Start it from Audits on the desk view, then come back
          here to walk the floor.
        </p>
      )}
    </div>
  );
}
