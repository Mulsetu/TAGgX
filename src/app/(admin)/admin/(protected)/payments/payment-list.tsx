import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatInr } from "@/lib/money";
import type { BillingPayment, PaymentMethod } from "@/modules/billing/types";

const METHOD_LABELS: Record<PaymentMethod, string> = {
  razorpay: "Razorpay",
  upi: "UPI",
  bank_transfer: "Bank transfer",
  neft: "NEFT",
  rtgs: "RTGS",
  cash: "Cash",
  cheque: "Cheque",
  other: "Other",
};

export function PaymentList({ payments }: { payments: BillingPayment[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Method</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Reference</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payments.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                No payments recorded yet.
              </TableCell>
            </TableRow>
          ) : (
            payments.map((payment) => (
              <TableRow key={payment.id}>
                <TableCell>{new Date(payment.paymentDate).toLocaleDateString("en-IN")}</TableCell>
                <TableCell>{METHOD_LABELS[payment.paymentMethod]}</TableCell>
                <TableCell>
                  {formatInr(payment.amount)} {payment.currency}
                </TableCell>
                <TableCell>{payment.paymentStatus.replaceAll("_", " ")}</TableCell>
                <TableCell className="font-mono text-xs">{payment.referenceNumber ?? "—"}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
