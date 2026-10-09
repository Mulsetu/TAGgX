import Link from "next/link";
import { ChevronRight, ClipboardCheck, MapPin, ScanLine } from "lucide-react";
import { assertModule } from "@/lib/permissions/features";
import { assertPermission, requirePermission } from "@/lib/permissions/has-permission";
import { AuditProgressBar } from "@/components/audits/audit-progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getAuditLocationsForForm, getAuditsForAdmin } from "@/modules/audits/actions";
import { AUDIT_STATUS_LABELS, type AuditListFilter, type AuditStatus } from "@/modules/audits/types";
import { cn } from "@/lib/utils";
import { CreateAuditForm } from "./create-audit-form";

interface AuditsPageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

const FILTERS: { id: AuditListFilter; label: string }[] = [
  { id: "active", label: "Running" },
  { id: "draft", label: "Drafts" },
  { id: "completed", label: "Completed" },
  { id: "all", label: "All" },
];

const EMPTY_TEXT: Record<AuditListFilter, string> = {
  active: "No audit is running right now. Start one from Drafts, or create a new audit.",
  draft: "No drafts. Create a new audit to get started.",
  completed: "No completed audits yet.",
  all: "No audits yet. Create one to start checking your assets.",
};

function statusVariant(status: AuditStatus) {
  if (status === "active") return "default" as const;
  if (status === "completed") return "secondary" as const;
  return "outline" as const;
}

function listHref(filter: AuditListFilter, page?: number): string {
  const params = new URLSearchParams({ status: filter });
  if (page && page > 1) params.set("page", String(page));
  return `/dashboard/administration/audits?${params.toString()}`;
}

export default async function AuditsPage({ searchParams }: AuditsPageProps) {
  await assertModule("audits");
  await assertPermission("audits", "view");
  const [{ items, totalCount, page, pageSize, filter }, locations, canCreate, canScan] = await Promise.all([
    getAuditsForAdmin(searchParams),
    getAuditLocationsForForm(),
    requirePermission("audits", "create"),
    requirePermission("audits", "edit"),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Audits</h1>
          <p className="text-sm text-muted-foreground">
            Check that assets are where they should be and in the expected condition.
          </p>
        </div>
        {canCreate ? <CreateAuditForm locations={locations} /> : null}
      </div>

      <nav className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" aria-label="Filter audits">
        {FILTERS.map((entry) => (
          <Link
            key={entry.id}
            href={listHref(entry.id)}
            aria-current={filter === entry.id ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
              filter === entry.id
                ? "bg-primary text-primary-foreground"
                : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50",
            )}
          >
            {entry.label}
          </Link>
        ))}
      </nav>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed bg-white p-8 text-center">
          <ClipboardCheck className="size-8 text-slate-400" />
          <p className="max-w-sm text-sm text-slate-500">{EMPTY_TEXT[filter]}</p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 @2xl:grid-cols-2 @5xl:grid-cols-3">
          {items.map((audit) => {
            const detailHref = `/dashboard/administration/audits/${audit.id}`;
            const running = audit.status === "active";
            return (
              <li key={audit.id} className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4">
                <Link href={detailHref} className="group flex flex-col gap-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-slate-900 group-hover:underline">{audit.name}</p>
                      <p className="flex items-center gap-1 text-sm text-slate-500">
                        <MapPin className="size-3.5 shrink-0" />
                        <span className="truncate">
                          {audit.locationName ?? "All locations"} · {audit.scheduledDate}
                        </span>
                      </p>
                    </div>
                    <Badge variant={statusVariant(audit.status)}>{AUDIT_STATUS_LABELS[audit.status]}</Badge>
                  </div>
                  {audit.status === "draft" ? (
                    <p className="text-sm text-slate-500">{audit.totalItems} asset(s) · not started</p>
                  ) : (
                    <AuditProgressBar audit={audit} />
                  )}
                  {audit.status === "completed" ? (
                    <p className="text-sm text-slate-500">
                      <span className="text-emerald-700">{audit.verifiedCount} OK</span> ·{" "}
                      <span className="text-red-600">{audit.exceptionCount} with problems</span>
                    </p>
                  ) : null}
                </Link>
                <div className="mt-auto flex gap-2">
                  {running && canScan ? (
                    <Button asChild className="flex-1">
                      <Link href={`/floor/audits/${audit.id}`}>
                        <ScanLine className="size-4" />
                        {audit.unverifiedCount > 0 ? "Scan" : "Review scans"}
                      </Link>
                    </Button>
                  ) : null}
                  <Button asChild variant="outline" className={running && canScan ? "" : "flex-1"}>
                    <Link href={detailHref}>
                      {audit.status === "draft" ? "Open draft" : running && canScan ? "Details" : "View results"}
                      <ChevronRight className="size-4" />
                    </Link>
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            {page > 1 ? (
              <Button asChild variant="outline" className="min-h-11">
                <Link href={listHref(filter, page - 1)}>Previous</Link>
              </Button>
            ) : null}
            {page < totalPages ? (
              <Button asChild variant="outline" className="min-h-11">
                <Link href={listHref(filter, page + 1)}>Next</Link>
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
