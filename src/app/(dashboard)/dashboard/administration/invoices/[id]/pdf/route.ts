import { invoiceNumber, renderInvoicePdf } from "@/lib/invoice";
import { getInvoiceForCurrentCompany } from "@/modules/billing/actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Downloads one payment's invoice as a PDF; the action scopes it to the caller's company and permission. */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const invoice = await getInvoiceForCurrentCompany(params.id);
  if (!invoice) {
    return new Response("Not found", { status: 404 });
  }

  const bytes = await renderInvoicePdf(invoice);
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${invoiceNumber(invoice.payment)}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
