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
import type { CompanySummary } from "@/modules/companies/types";
import { CompanyDetailDialog } from "./company-detail-dialog";

export function CompanyList({ companies }: { companies: CompanySummary[] }) {
  const [selected, setSelected] = useState<CompanySummary | null>(null);
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Infra</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {companies.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No companies yet.
                </TableCell>
              </TableRow>
            ) : (
              companies.map((company) => (
                <TableRow
                  key={company.id}
                  className="cursor-pointer"
                  onClick={() => {
                    setSelected(company);
                    setOpen(true);
                  }}
                >
                  <TableCell className="font-medium">{company.name}</TableCell>
                  <TableCell className="text-muted-foreground">{company.adminEmail ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{company.slug}</TableCell>
                  <TableCell>
                    {company.isDedicatedInfra ? (
                      <Badge variant="secondary">Dedicated</Badge>
                    ) : (
                      <span className="text-muted-foreground">Shared</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {/* Fixed locale: this renders both server- and client-side (client
                        component), and an implicit locale can differ between Node's
                        default and the browser's, causing a hydration mismatch. */}
                    {new Date(company.createdAt).toLocaleDateString("en-US")}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <CompanyDetailDialog company={selected} open={open} onOpenChange={setOpen} />
    </>
  );
}
