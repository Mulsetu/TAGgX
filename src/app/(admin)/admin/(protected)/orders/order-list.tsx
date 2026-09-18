"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
import { cancelBillingOrderAction, fulfillBillingOrderAction } from "@/modules/billing/actions";
import type { BillingOrder } from "@/modules/billing/types";

export function OrderList({ orders }: { orders: BillingOrder[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleFulfill(orderId: string) {
    setError(null);
    setPendingId(orderId);
    startTransition(async () => {
      const result = await fulfillBillingOrderAction(orderId);
      setPendingId(null);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function handleCancel(orderId: string) {
    setError(null);
    setPendingId(orderId);
    startTransition(async () => {
      const result = await cancelBillingOrderAction(orderId);
      setPendingId(null);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company</TableHead>
              <TableHead>Packs</TableHead>
              <TableHead>Assets</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Requested</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No pending extra-asset requests.
                </TableCell>
              </TableRow>
            ) : (
              orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">
                    {order.companyName}
                    <p className="text-xs font-normal text-muted-foreground">/{order.companySlug}</p>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{order.packs}</TableCell>
                  <TableCell className="text-muted-foreground">
                    +{order.assetQuantity.toLocaleString("en-IN")}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatInr(order.amount)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(order.createdAt).toLocaleDateString("en-US")}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={isPending && pendingId === order.id}
                        onClick={() => handleFulfill(order.id)}
                      >
                        {isPending && pendingId === order.id ? "Saving..." : "Mark paid"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={isPending && pendingId === order.id}
                        onClick={() => handleCancel(order.id)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
