import Link from "next/link";
import { assertModule } from "@/lib/permissions/features";
import { assertPermission, requirePermission } from "@/lib/permissions/has-permission";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getAuditLocationsForForm, getAuditsForAdmin } from "@/modules/audits/actions";
import { AUDIT_STATUS_LABELS } from "@/modules/audits/types";
import { CreateAuditForm } from "./create-audit-form";

interface AuditsPageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

function statusVariant(status: "draft" | "active" | "completed") {
  if (status === "active") return "default" as const;
  if (status === "completed") return "secondary" as const;
  return "outline" as const;
}

export default async function AuditsPage({ searchParams }: AuditsPageProps) {
  await assertModule("audits");
  await assertPermission("audits", "view");
  const [{ items, totalCount, page, pageSize }, locations, canCreate] = await Promise.all([
    getAuditsForAdmin(searchParams),
    getAuditLocationsForForm(),
    requirePermission("audits", "create"),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Physical audits</h1>
          <p className="text-sm text-muted-foreground">
            Verify that assets are present, in the right place, and in the expected condition.
          </p>
        </div>
        {canCreate ? <CreateAuditForm locations={locations} /> : null}
      </div>

      <Button asChild variant="outline" className="w-full sm:w-auto" size="touch">
        <Link href="/floor/audits">Open floor audit on this phone</Link>
      </Button>

      {items.length === 0 ? (
        <p className="rounded-lg border p-4 text-center text-sm text-muted-foreground">No audit campaigns yet.</p>
      ) : (
        <>
          <ul className="flex flex-col gap-3 md:hidden">
            {items.map((audit) => (
              <li key={audit.id}>
                <Link
                  href={`/dashboard/administration/audits/${audit.id}`}
                  className="flex min-h-16 flex-col gap-1 rounded-xl border p-4 active:bg-muted"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-medium">{audit.name}</span>
                    <Badge variant={statusVariant(audit.status)}>{AUDIT_STATUS_LABELS[audit.status]}</Badge>
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {audit.scheduledDate} · {audit.locationName ?? "All locations"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {audit.progressPercent}% · {audit.verifiedCount} verified
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto rounded-lg border md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Progress</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((audit) => (
                  <TableRow key={audit.id}>
                    <TableCell className="font-medium">
                      <Link href={`/dashboard/administration/audits/${audit.id}`} className="hover:underline">
                        {audit.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{audit.scheduledDate}</TableCell>
                    <TableCell className="text-muted-foreground">{audit.locationName ?? "All locations"}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(audit.status)}>{AUDIT_STATUS_LABELS[audit.status]}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {audit.progressPercent}% · {audit.verifiedCount} verified · {audit.exceptionCount} exceptions
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            {page > 1 ? (
              <Button asChild variant="outline" className="min-h-11">
                <Link href={`/dashboard/administration/audits?page=${page - 1}`}>Previous</Link>
              </Button>
            ) : null}
            {page < totalPages ? (
              <Button asChild variant="outline" className="min-h-11">
                <Link href={`/dashboard/administration/audits?page=${page + 1}`}>Next</Link>
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
