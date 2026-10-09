"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarClock, Mail, QrCode, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
import { MAINTENANCE_STATUSES } from "@/modules/maintenance/types";
import type { MaintenancePriority, MaintenanceTicketSummary } from "@/modules/maintenance/types";
import { updateTicketAction } from "@/modules/maintenance/actions";
import type { AssetOption } from "@/modules/assets/types";

const initialState = { error: null as string | null };

const PRIORITY_CLASS: Record<MaintenancePriority, string> = {
  low: "bg-slate-100 text-slate-600",
  normal: "bg-sky-50 text-sky-700",
  high: "bg-amber-50 text-amber-800",
  emergency: "bg-red-50 text-red-700",
};

function label(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function isOverdue(ticket: MaintenanceTicketSummary): boolean {
  if (!ticket.dueAt || (ticket.status !== "open" && ticket.status !== "in_progress")) return false;
  return ticket.dueAt < new Date().toISOString().slice(0, 10);
}

/**
 * One card per ticket for every screen size: what's broken and on which
 * asset, who reported it (with a QR badge + reply email for public reports),
 * then the two things people change most — status and assignee.
 */
function TicketCard({ ticket, users }: { ticket: MaintenanceTicketSummary; users: AssetOption[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const overdue = isOverdue(ticket);

  function update(status: string, assignedTo: string) {
    setError(null);
    const formData = new FormData();
    formData.set("status", status);
    formData.set("assignedTo", assignedTo);
    startTransition(async () => {
      const result = await updateTicketAction(ticket.id, initialState, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <li
      className={cn(
        "flex flex-col gap-3 rounded-xl border bg-white p-4",
        ticket.source === "public_qr" && ticket.status === "open" ? "border-amber-300" : "border-slate-200",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-slate-900">{ticket.title}</p>
          <Link href={`/assets/${ticket.assetId}`} className="text-sm text-[hsl(var(--brand-primary))] hover:underline">
            {ticket.assetName} · {ticket.assetCode}
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {ticket.source === "public_qr" ? (
            <Badge variant="outline" className="gap-1 border-amber-300 bg-amber-50 text-amber-800">
              <QrCode className="size-3" /> QR report
            </Badge>
          ) : null}
          <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", PRIORITY_CLASS[ticket.priority])}>
            {label(ticket.priority)}
          </span>
        </div>
      </div>

      {ticket.description ? <p className="line-clamp-3 text-sm text-slate-600">{ticket.description}</p> : null}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
        <span>
          {ticket.source === "public_qr" ? "Reported by " : "By "}
          {ticket.reportedByName ?? "—"} · {formatDate(ticket.openedAt)}
        </span>
        {ticket.reporterEmail ? (
          <a href={`mailto:${ticket.reporterEmail}`} className="inline-flex items-center gap-1 hover:underline">
            <Mail className="size-3" />
            {ticket.reporterEmail}
          </a>
        ) : null}
        {ticket.dueAt ? (
          <span className={cn("inline-flex items-center gap-1", overdue && "font-medium text-red-600")}>
            <CalendarClock className="size-3" />
            {overdue ? "Overdue · " : "Due "}
            {formatDate(ticket.dueAt)}
          </span>
        ) : null}
        <span className="inline-flex items-center gap-1">
          <Wrench className="size-3" />
          {label(ticket.typeKey)}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-2 border-t border-slate-100 pt-3 @md:grid-cols-2">
        <NativeSelect
          value={ticket.status}
          disabled={isPending}
          onChange={(event) => update(event.target.value, ticket.assignedToId ?? "")}
          aria-label={`Status for ${ticket.title}`}
        >
          {MAINTENANCE_STATUSES.map((status) => (
            <option key={status} value={status}>
              {label(status)}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          value={ticket.assignedToId ?? ""}
          disabled={isPending}
          onChange={(event) => update(ticket.status, event.target.value)}
          aria-label={`Assignee for ${ticket.title}`}
        >
          <option value="">Unassigned</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name}
            </option>
          ))}
        </NativeSelect>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </li>
  );
}

export function TicketList({
  tickets,
  users,
  emptyText,
}: {
  tickets: MaintenanceTicketSummary[];
  users: AssetOption[];
  emptyText: string;
}) {
  if (tickets.length === 0) {
    return (
      <p className="rounded-xl border border-dashed bg-white p-8 text-center text-sm text-muted-foreground">{emptyText}</p>
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-3 @4xl:grid-cols-2">
      {tickets.map((ticket) => (
        <TicketCard key={ticket.id} ticket={ticket} users={users} />
      ))}
    </ul>
  );
}
