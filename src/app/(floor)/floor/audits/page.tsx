import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { getActiveAuditsForFloor } from "@/modules/audits/actions";
import { AUDIT_STATUS_LABELS } from "@/modules/audits/types";

export default async function FloorAuditsPage() {
  const audits = await getActiveAuditsForFloor();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Walk an audit</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sign in on this phone, open an active audit, then scan each TagX sticker with the Camera
          app — or use in-page camera where the browser allows it.
        </p>
      </div>
      {audits.length === 0 ? (
        <p className="rounded-lg border p-4 text-sm text-muted-foreground">
          No active audits. A supervisor must start a campaign from Audits on the desk view.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {audits.map((audit) => (
            <li key={audit.id}>
              <Link
                href={`/floor/audits/${audit.id}`}
                className="flex min-h-16 flex-col gap-1 rounded-xl border p-4 active:bg-muted"
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="font-medium">{audit.name}</span>
                  <Badge>{AUDIT_STATUS_LABELS[audit.status]}</Badge>
                </span>
                <span className="text-sm text-muted-foreground">
                  {audit.locationName ?? "All locations"} · {audit.progressPercent}% ·{" "}
                  {audit.unverifiedCount} left
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
