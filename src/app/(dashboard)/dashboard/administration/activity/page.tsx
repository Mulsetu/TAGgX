import { assertPermission } from "@/lib/permissions/has-permission";
import { getAuditLogForAdmin } from "@/modules/activity/actions";

export default async function ActivityPage() {
  await assertPermission("settings", "view");
  const entries = await getAuditLogForAdmin();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Activity</h1>
        <p className="text-sm text-muted-foreground">Configuration and record changes in this workspace.</p>
      </div>
      <ul className="flex flex-col divide-y rounded-lg border">
        {entries.length === 0 ? (
          <li className="p-4 text-sm text-muted-foreground">No activity recorded yet.</li>
        ) : (
          entries.map((entry) => (
            <li key={entry.id} className="flex flex-col gap-1 p-4 text-sm">
              <span className="font-medium">{entry.action}</span>
              <span className="text-xs text-muted-foreground">
                {entry.entityType}
                {entry.entityId ? ` · ${entry.entityId}` : ""} · {new Date(entry.createdAt).toLocaleString("en-IN")}
              </span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
