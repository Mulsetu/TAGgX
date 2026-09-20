"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MAINTENANCE_STATUSES } from "@/modules/maintenance/types";
import type { MaintenanceTicketSummary } from "@/modules/maintenance/types";
import { updateTicketAction } from "@/modules/maintenance/actions";
import type { AssetOption } from "@/modules/assets/types";

const initialState = { error: null as string | null };

function formatStatusLabel(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function TicketRow({ ticket, users }: { ticket: MaintenanceTicketSummary; users: AssetOption[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleUpdate(formData: FormData) {
    setError(null);
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
    <TableRow>
      <TableCell className="font-medium">{ticket.title}</TableCell>
      <TableCell className="text-muted-foreground">
        {ticket.assetName} ({ticket.assetCode})
      </TableCell>
      <TableCell className="text-muted-foreground">{ticket.reportedByName ?? "—"}</TableCell>
      <TableCell>
        <form
          action={(formData) => {
            formData.set("assignedTo", ticket.assignedToId ?? "");
            handleUpdate(formData);
          }}
        >
          <NativeSelect
            className="w-auto"
            name="status"
            defaultValue={ticket.status}
            disabled={isPending}
            onChange={(e) => e.currentTarget.form?.requestSubmit()}
          >
            {MAINTENANCE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {formatStatusLabel(status)}
              </option>
            ))}
          </NativeSelect>
        </form>
      </TableCell>
      <TableCell>
        <form
          action={(formData) => {
            formData.set("status", ticket.status);
            handleUpdate(formData);
          }}
        >
          <NativeSelect
            className="w-auto"
            name="assignedTo"
            defaultValue={ticket.assignedToId ?? ""}
            disabled={isPending}
            onChange={(e) => e.currentTarget.form?.requestSubmit()}
          >
            <option value="">Unassigned</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </NativeSelect>
        </form>
      </TableCell>
      <TableCell className="text-muted-foreground">
        {new Date(ticket.openedAt).toLocaleDateString("en-US")}
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </TableCell>
    </TableRow>
  );
}

export function TicketList({
  tickets,
  users,
}: {
  tickets: MaintenanceTicketSummary[];
  users: AssetOption[];
}) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Asset</TableHead>
            <TableHead>Reported by</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Assigned to</TableHead>
            <TableHead>Opened</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tickets.length === 0 ? (
            <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                No maintenance tickets yet.
              </TableCell>
            </TableRow>
          ) : (
            tickets.map((ticket) => <TicketRow key={ticket.id} ticket={ticket} users={users} />)
          )}
        </TableBody>
      </Table>
    </div>
  );
}
