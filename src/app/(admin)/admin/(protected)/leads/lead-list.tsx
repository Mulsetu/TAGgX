"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { updateLeadAction } from "@/modules/crm/actions";
import type { CrmLead } from "@/modules/crm/types";
import { LEAD_STATUSES } from "@/modules/crm/types";

function formatWhen(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function LeadList({ leads }: { leads: CrmLead[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<CrmLead | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSave(formData: FormData) {
    if (!selected) {
      return;
    }
    formData.set("id", selected.id);
    startTransition(async () => {
      const result = await updateLeadAction({ error: null }, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setError(null);
      setSelected(null);
      router.refresh();
    });
  }

  return (
    <>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No leads yet. Demo and inquire forms write here.
                </TableCell>
              </TableRow>
            ) : (
              leads.map((lead) => (
                <TableRow
                  key={lead.id}
                  className="cursor-pointer"
                  onClick={() => {
                    setError(null);
                    setSelected(lead);
                  }}
                >
                  <TableCell className="whitespace-nowrap text-sm">{formatWhen(lead.createdAt)}</TableCell>
                  <TableCell className="capitalize">{lead.source}</TableCell>
                  <TableCell>{lead.fullName}</TableCell>
                  <TableCell>{lead.companyName ?? "—"}</TableCell>
                  <TableCell>{lead.email}</TableCell>
                  <TableCell className="capitalize">{lead.status}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          {selected ? (
            <>
              <DialogHeader>
                <DialogTitle>{selected.fullName}</DialogTitle>
                <DialogDescription>
                  {selected.source === "demo" ? "Demo request" : "Inquiry"} · {selected.email}
                </DialogDescription>
              </DialogHeader>
              <dl className="grid gap-2 text-sm">
                <div>
                  <dt className="text-muted-foreground">Phone</dt>
                  <dd>{selected.phone ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Company / role</dt>
                  <dd>
                    {selected.companyName ?? "—"}
                    {selected.jobTitle ? ` · ${selected.jobTitle}` : ""}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Assets</dt>
                  <dd>{selected.assetCount ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Preferred date</dt>
                  <dd>{selected.preferredDate ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Message</dt>
                  <dd className="whitespace-pre-wrap">{selected.message ?? "—"}</dd>
                </div>
              </dl>
              <form action={handleSave} className="mt-4 flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="status">Pipeline status</Label>
                  <NativeSelect id="status" name="status" defaultValue={selected.status}>
                    {LEAD_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="notes">Internal notes</Label>
                  <Textarea id="notes" name="notes" rows={4} maxLength={2000} defaultValue={selected.notes ?? ""} />
                </div>
                {error ? (
                  <p role="alert" className="text-sm text-destructive">
                    {error}
                  </p>
                ) : null}
                <DialogFooter>
                  <Button type="submit" disabled={isPending}>
                    {isPending ? "Saving…" : "Save lead"}
                  </Button>
                </DialogFooter>
              </form>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
