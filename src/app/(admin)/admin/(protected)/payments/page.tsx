import { getRecentPaymentsForAdmin } from "@/modules/billing/actions";
import { PaymentList } from "./payment-list";

export default async function AdminPaymentsPage() {
  const payments = await getRecentPaymentsForAdmin();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Payments</h1>
        <p className="text-sm text-muted-foreground">
          Real financial events only — Razorpay and offline methods such as RTGS, NEFT, UPI, cash, and
          cheque. Demo and complimentary accounts should not have fake payment rows.
        </p>
      </div>
      <PaymentList payments={payments} />
    </div>
  );
}
