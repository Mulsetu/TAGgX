import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { TagXLogo } from "@/components/layout/brand-logo";
import { assertPermission } from "@/lib/permissions/has-permission";
import { formatInr } from "@/lib/money";
import { getInvoiceForCurrentCompany } from "@/modules/billing/actions";
import { PrintButton } from "./print-button";

const METHOD_LABELS: Record<string, string> = {
  razorpay: "Razorpay (card / UPI / net banking)",
  upi: "UPI",
  bank_transfer: "Bank transfer",
  neft: "NEFT",
  rtgs: "RTGS",
  cash: "Cash",
  cheque: "Cheque",
  other: "Other",
};

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" }).format(
    new Date(iso),
  );
}

/** Receipt-style invoice for one payment — opens from Billing › Invoices & payments, and prints cleanly to PDF. */
export default async function InvoicePage({ params }: { params: { id: string } }) {
  await assertPermission("settings", "view");
  const invoice = await getInvoiceForCurrentCompany(params.id);
  if (!invoice) {
    notFound();
  }

  const { payment, plan, billingContact, companySlug } = invoice;
  const number = `INV-${payment.paymentDate.slice(0, 10).replace(/-/g, "")}-${payment.id.slice(0, 6).toUpperCase()}`;
  const paid = payment.paymentStatus === "paid";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <Link
          href="/dashboard/administration/settings/billing"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:underline"
        >
          <ChevronLeft className="size-4" /> Billing
        </Link>
        <PrintButton />
      </div>

      <article className="invoice-sheet mx-auto w-full max-w-3xl rounded-xl border border-slate-200 bg-white p-6 sm:p-10 print:max-w-none print:rounded-none print:border-0 print:p-0">
        <header className="flex flex-wrap items-start justify-between gap-6 border-b border-slate-200 pb-6">
          <div>
            <TagXLogo size={56} className="h-12 w-auto" />
            <p className="mt-2 text-xs text-slate-500">TagX by Mulsetu · Asset management</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-semibold tracking-tight text-slate-900">{paid ? "Invoice / Receipt" : "Invoice"}</p>
            <p className="text-sm text-slate-500">{number}</p>
            <p className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase ${paid ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>
              {payment.paymentStatus.replaceAll("_", " ")}
            </p>
          </div>
        </header>

        <section className="grid gap-6 py-6 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Billed to</p>
            <p className="mt-1 font-medium text-slate-900">{billingContact.companyName}</p>
            <p className="text-sm text-slate-500">Workspace /{companySlug}</p>
            {billingContact.address ? <p className="text-sm text-slate-600">{billingContact.address}</p> : null}
            {billingContact.email ? <p className="text-sm text-slate-600">{billingContact.email}</p> : null}
            {billingContact.phone ? <p className="text-sm text-slate-600">{billingContact.phone}</p> : null}
          </div>
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm sm:justify-self-end">
            <dt className="text-slate-500">Date</dt>
            <dd className="text-slate-900">{formatDate(payment.paymentDate)}</dd>
            <dt className="text-slate-500">Paid by</dt>
            <dd className="text-slate-900">{METHOD_LABELS[payment.paymentMethod] ?? payment.paymentMethod}</dd>
            {payment.referenceNumber ? (
              <>
                <dt className="text-slate-500">Reference</dt>
                <dd className="break-all text-slate-900">{payment.referenceNumber}</dd>
              </>
            ) : null}
          </dl>
        </section>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-y border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="py-2 font-medium">Description</th>
              <th className="py-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-100">
              <td className="py-3 text-slate-900">
                {plan?.name ?? "TagX"} subscription
                {plan ? <span className="block text-xs text-slate-500">Up to {plan.assetLimit.toLocaleString("en-IN")} assets</span> : null}
              </td>
              <td className="py-3 text-right text-slate-900">{formatInr(payment.amount)}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td className="pt-4 text-right font-semibold text-slate-900">Total ({payment.currency})</td>
              <td className="pt-4 text-right text-lg font-semibold text-slate-900">{formatInr(payment.amount)}</td>
            </tr>
          </tfoot>
        </table>

        <p className="mt-10 border-t border-slate-200 pt-4 text-xs text-slate-500">
          This is a computer-generated payment receipt and does not need a signature. For a GST tax invoice or billing
          questions, contact the TagX team.
        </p>
      </article>
    </div>
  );
}
