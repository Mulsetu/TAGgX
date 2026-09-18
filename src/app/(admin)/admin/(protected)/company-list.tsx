"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { BillingPlan, CompanyBillingSnapshot } from "@/modules/billing/types";
import type { CompanySummary } from "@/modules/companies/types";
import { CompanyDetailDialog } from "./company-detail-dialog";

export function CompanyList({
  companies,
  plans,
  billingByCompanyId,
}: {
  companies: CompanySummary[];
  plans: BillingPlan[];
  billingByCompanyId: Record<string, CompanyBillingSnapshot>;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const selected = companies.find((company) => company.id === selectedId) ?? null;

  return (
    <>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Assets</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {companies.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No companies yet.
                </TableCell>
              </TableRow>
            ) : (
              companies.map((company) => {
                const billing = billingByCompanyId[company.id];
                const assetLabel =
                  billing?.effectiveLimit !== undefined && billing.effectiveLimit !== null
                    ? `${billing.assetCount.toLocaleString("en-IN")} / ${billing.effectiveLimit.toLocaleString("en-IN")}`
                    : billing
                      ? String(billing.assetCount)
                      : "—";

                return (
                  <TableRow
                    key={company.id}
                    className="cursor-pointer"
                    onClick={() => {
                      setSelectedId(company.id);
                      setOpen(true);
                    }}
                  >
                    <TableCell className="font-medium">
                      <span className="flex items-center gap-2">
                        {company.name}
                        {company.suspendedAt ? <Badge variant="destructive">Suspended</Badge> : null}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{company.adminEmail ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{company.slug}</TableCell>
                    <TableCell>
                      {billing?.planName ? (
                        <span className="flex items-center gap-2">
                          {billing.planName}
                          {billing.pendingOrderCount > 0 ? (
                            <Badge variant="secondary">{billing.pendingOrderCount} pending</Badge>
                          ) : null}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">No plan</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{assetLabel}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {/* Fixed locale: this renders both server- and client-side (client
                          component), and an implicit locale can differ between Node's
                          default and the browser's, causing a hydration mismatch. */}
                      {new Date(company.createdAt).toLocaleDateString("en-US")}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <CompanyDetailDialog
        company={selected}
        billing={selected ? billingByCompanyId[selected.id] ?? null : null}
        plans={plans}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
