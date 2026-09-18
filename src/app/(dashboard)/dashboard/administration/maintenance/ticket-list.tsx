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

function useTicketUpdate(ticket: MaintenanceTicketSummary) {
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

  return { error, isPending, handleUpdate };
}

function StatusSelect({
  ticket,
  isPending,
  handleUpdate,
  className,
}: {
  ticket: MaintenanceTicketSummary;
  isPending: boolean;
  handleUpdate: (formData: FormData) => void;
  className?: string;
}) {
  return (
    <form
      action={(formData) => {
        formData.set("assignedTo", ticket.assignedToId ?? "");
        handleUpdate(formData);
      }}
    >
      <NativeSelect
        className={className}
        name="status"
        defaultValue={ticket.status}
        disabled={isPending}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
        aria-label="Ticket status"
      >
        {MAINTENANCE_STATUSES.map((status) => (
          <option key={status} value={status}>
            {formatStatusLabel(status)}
          </option>
        ))}
      </NativeSelect>
    </form>
  );
}

function AssigneeSelect({
  ticket,
  users,
  isPending,
  handleUpdate,
  className,
}: {
  ticket: MaintenanceTicketSummary;
  users: AssetOption[];
  isPending: boolean;
  handleUpdate: (formData: FormData) => void;
  className?: string;
}) {
  return (
    <form
      action={(formData) => {
        formData.set("status", ticket.status);
        handleUpdate(formData);
      }}
    >
      <NativeSelect
        className={className}
        name="assignedTo"
        defaultValue={ticket.assignedToId ?? ""}
        disabled={isPending}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
        aria-label="Assigned to"
      >
        <option value="">Unassigned</option>
        {users.map((user) => (
          <option key={user.id} value={user.id}>
            {user.name}
          </option>
        ))}
      </NativeSelect>
    </form>
  );
}

function TicketRow({ ticket, users }: { ticket: MaintenanceTicketSummary; users: AssetOption[] }) {
  const { error, isPending, handleUpdate } = useTicketUpdate(ticket);

  return (
    <TableRow>
      <TableCell className="font-medium">{ticket.title}</TableCell>
      <TableCell className="text-muted-foreground">
        {ticket.assetName} ({ticket.assetCode})
      </TableCell>
      <TableCell className="text-muted-foreground">{ticket.reportedByName ?? "—"}</TableCell>
      <TableCell className="capitalize text-muted-foreground">{ticket.priority}</TableCell>
      <TableCell className="text-muted-foreground">{ticket.dueAt ?? "—"}</TableCell>
      <TableCell>
        <StatusSelect ticket={ticket} isPending={isPending} handleUpdate={handleUpdate} className="w-auto" />
      </TableCell>
      <TableCell>
        <AssigneeSelect
          ticket={ticket}
          users={users}
          isPending={isPending}
          handleUpdate={handleUpdate}
          className="w-auto"
        />
      </TableCell>
      <TableCell className="text-muted-foreground">
        {new Date(ticket.openedAt).toLocaleDateString("en-US")}
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </TableCell>
    </TableRow>
  );
}

function TicketCard({ ticket, users }: { ticket: MaintenanceTicketSummary; users: AssetOption[] }) {
  const { error, isPending, handleUpdate } = useTicketUpdate(ticket);

  return (
    <li className="flex flex-col gap-3 rounded-xl border p-4">
      <div>
        <p className="font-medium">{ticket.title}</p>
        <p className="text-sm text-muted-foreground">
          {ticket.assetName} ({ticket.assetCode})
        </p>
        <p className="text-xs text-muted-foreground">
          {ticket.reportedByName ?? "—"} · {ticket.priority} · due {ticket.dueAt ?? "—"} ·{" "}
          {new Date(ticket.openedAt).toLocaleDateString("en-US")}
        </p>
      </div>
      <StatusSelect ticket={ticket} isPending={isPending} handleUpdate={handleUpdate} className="w-full" />
      <AssigneeSelect
        ticket={ticket}
        users={users}
        isPending={isPending}
        handleUpdate={handleUpdate}
        className="w-full"
      />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </li>
  );
}

export function TicketList({
  tickets,
  users,
}: {
  tickets: MaintenanceTicketSummary[];
  users: AssetOption[];
}) {
  if (tickets.length === 0) {
    return (
      <p className="rounded-lg border p-4 text-center text-sm text-muted-foreground">
        No maintenance tickets yet.
      </p>
    );
  }

  return (
    <>
      <ul className="flex flex-col gap-3 md:hidden">
        {tickets.map((ticket) => (
          <TicketCard key={ticket.id} ticket={ticket} users={users} />
        ))}
      </ul>
      <div className="hidden overflow-x-auto rounded-lg border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Asset</TableHead>
              <TableHead>Reported by</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Due</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Assigned to</TableHead>
              <TableHead>Opened</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tickets.map((ticket) => (
              <TicketRow key={ticket.id} ticket={ticket} users={users} />
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
