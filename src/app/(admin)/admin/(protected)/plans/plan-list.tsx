"use client";

import { useState } from "react";
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
import { formatInr } from "@/lib/money";
import type { BillingPlan } from "@/modules/billing/types";
import { PlanFormDialog } from "./plan-form-dialog";

export function PlanList({ plans }: { plans: BillingPlan[] }) {
  const [selected, setSelected] = useState<BillingPlan | null>(null);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");

  return (
    <>
      <div className="flex justify-end">
        <Button
          type="button"
          onClick={() => {
            setSelected(null);
            setMode("create");
            setOpen(true);
          }}
        >
          New plan
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Price / month</TableHead>
              <TableHead>Asset cap</TableHead>
              <TableHead>Extra pack</TableHead>
              <TableHead>Modules</TableHead>
              <TableHead>Listed</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {plans.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No plans yet.
                </TableCell>
              </TableRow>
            ) : (
              plans.map((plan) => (
                <TableRow
                  key={plan.id}
                  className="cursor-pointer"
                  onClick={() => {
                    setSelected(plan);
                    setMode("edit");
                    setOpen(true);
                  }}
                >
                  <TableCell className="font-medium">{plan.name}</TableCell>
                  <TableCell className="text-muted-foreground">{formatInr(plan.priceMonthly)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {plan.assetLimit.toLocaleString("en-IN")}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {plan.extraAssetQuantity.toLocaleString("en-IN")} for {formatInr(plan.extraAssetPrice)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {plan.includedModules == null ? "All" : `${plan.includedModules.length} modules`}
                  </TableCell>
                  <TableCell>
                    {plan.isActive ? (
                      <Badge variant="secondary">Public</Badge>
                    ) : (
                      <span className="text-muted-foreground">Hidden</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <PlanFormDialog
        mode={mode}
        plan={selected}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
