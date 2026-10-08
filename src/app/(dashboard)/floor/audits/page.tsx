import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getActiveAuditsForFloor } from "@/modules/audits/actions";
import { AUDIT_STATUS_LABELS } from "@/modules/audits/types";

export default async function FloorAuditsPage() {
  const audits = await getActiveAuditsForFloor();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Floor audit</h1>
        <p className="text-sm text-muted-foreground">
          Open an active campaign and scan each TagX sticker. Use the camera on this device, or the
          Camera app if the browser blocks it.
        </p>
      </div>

      {audits.length === 0 ? (
        <p className="rounded-lg border p-4 text-sm text-muted-foreground">
          No active audits. Start a campaign from Audits, then come back here to walk the floor.
        </p>
      ) : (
        <>
          <ul className="flex flex-col gap-3 md:hidden">
            {audits.map((audit) => (
              <li key={audit.id}>
                <Link
                  href={`/floor/audits/${audit.id}`}
                  className="flex min-h-16 flex-col gap-1 rounded-xl border bg-white p-4"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-medium">{audit.name}</span>
                    <Badge>{AUDIT_STATUS_LABELS[audit.status]}</Badge>
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {audit.scheduledDate} · {audit.locationName ?? "All locations"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {audit.progressPercent}% · {audit.unverifiedCount} left
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
                {audits.map((audit) => (
                  <TableRow key={audit.id}>
                    <TableCell className="font-medium">
                      <Link href={`/floor/audits/${audit.id}`} className="hover:underline">
                        {audit.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{audit.scheduledDate}</TableCell>
                    <TableCell className="text-muted-foreground">{audit.locationName ?? "All locations"}</TableCell>
                    <TableCell>
                      <Badge>{AUDIT_STATUS_LABELS[audit.status]}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {audit.progressPercent}% · {audit.verifiedCount} verified · {audit.unverifiedCount} left
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
