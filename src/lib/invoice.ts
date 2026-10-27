import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { BillingPayment, BillingPlan } from "@/modules/billing/types";

export const INVOICE_METHOD_LABELS: Record<string, string> = {
  razorpay: "Card (Razorpay)",
  upi: "UPI",
  bank_transfer: "Bank transfer",
  neft: "NEFT",
  rtgs: "RTGS",
  cash: "Cash",
  cheque: "Cheque",
  other: "Other",
};

export interface InvoiceData {
  payment: BillingPayment;
  plan: BillingPlan | null;
  billingContact: { companyName: string; email: string | null; phone: string | null; address: string | null };
  companySlug: string;
}

export function invoiceNumber(payment: BillingPayment): string {
  return `INV-${payment.paymentDate.slice(0, 10).replace(/-/g, "")}-${payment.id.slice(0, 6).toUpperCase()}`;
}

export function formatInvoiceDate(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" }).format(
    new Date(iso),
  );
}

// Standard PDF fonts only cover WinAnsi, so the rupee sign is spelled out.
function pdfAmount(amount: number, currency: string): string {
  return `${currency} ${new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)}`;
}

function winAnsi(text: string): string {
  return text
    .replace(/[–—]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, "...")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of winAnsi(text.replace(/\r/g, "")).split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (line && font.widthOfTextAtSize(next, size) > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

const INK = rgb(0.06, 0.09, 0.16);
const MUTED = rgb(0.39, 0.45, 0.55);
const RULE = rgb(0.89, 0.91, 0.94);

/** A4 invoice/receipt for one payment, laid out like a standard SaaS invoice. */
export async function renderInvoicePdf({ payment, plan, billingContact, companySlug }: InvoiceData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page: PDFPage = pdf.addPage([595.28, 841.89]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const { width, height } = page.getSize();
  const margin = 50;
  const right = width - margin;
  const paid = payment.paymentStatus === "paid";
  const number = invoiceNumber(payment);

  pdf.setTitle(`Invoice ${number}`);
  pdf.setAuthor("TagX by Mulsetu");

  const text = (value: string, x: number, y: number, options: { font?: PDFFont; size?: number; color?: typeof INK } = {}) => {
    page.drawText(winAnsi(value), { x, y, font: options.font ?? regular, size: options.size ?? 10, color: options.color ?? INK });
  };
  const textRight = (value: string, x: number, y: number, options: { font?: PDFFont; size?: number; color?: typeof INK } = {}) => {
    const font = options.font ?? regular;
    const size = options.size ?? 10;
    text(value, x - font.widthOfTextAtSize(winAnsi(value), size), y, options);
  };
  const rule = (y: number) => page.drawLine({ start: { x: margin, y }, end: { x: right, y }, thickness: 1, color: RULE });

  // Header: seller on the left, document title and number on the right.
  let y = height - margin - 10;
  text("TagX", margin, y, { font: bold, size: 22 });
  text("by Mulsetu · Asset management", margin, y - 16, { size: 9, color: MUTED });
  textRight(paid ? "INVOICE / RECEIPT" : "INVOICE", right, y, { font: bold, size: 18 });
  textRight(number, right, y - 16, { size: 10, color: MUTED });
  textRight(payment.paymentStatus.replaceAll("_", " ").toUpperCase(), right, y - 32, {
    font: bold,
    size: 9,
    color: paid ? rgb(0.02, 0.47, 0.34) : rgb(0.6, 0.38, 0.03),
  });
  y -= 52;
  rule(y);

  // Billed to + invoice details.
  y -= 24;
  const detailsTop = y;
  text("BILLED TO", margin, y, { font: bold, size: 8, color: MUTED });
  y -= 16;
  text(billingContact.companyName, margin, y, { font: bold, size: 11 });
  y -= 14;
  const contactLines = [
    `Workspace /${companySlug}`,
    ...(billingContact.address ? wrap(billingContact.address, regular, 10, 250) : []),
    ...(billingContact.email ? [billingContact.email] : []),
    ...(billingContact.phone ? [billingContact.phone] : []),
  ];
  for (const line of contactLines) {
    text(line, margin, y, { color: MUTED });
    y -= 14;
  }

  const details: [string, string][] = [
    ["Invoice number", number],
    ["Date of issue", formatInvoiceDate(payment.paymentDate)],
    [paid ? "Date paid" : "Status", paid ? formatInvoiceDate(payment.paymentDate) : payment.paymentStatus.replaceAll("_", " ")],
    ["Payment method", INVOICE_METHOD_LABELS[payment.paymentMethod] ?? payment.paymentMethod],
    ...(payment.referenceNumber ? ([["Reference", payment.referenceNumber]] as [string, string][]) : []),
  ];
  let dy = detailsTop;
  for (const [label, value] of details) {
    text(label, 330, dy, { size: 9, color: MUTED });
    textRight(value.length > 34 ? `${value.slice(0, 31)}...` : value, right, dy, { size: 9 });
    dy -= 15;
  }
  y = Math.min(y, dy) - 20;

  // Line items.
  const colQty = 360;
  const colUnit = 450;
  rule(y + 14);
  text("DESCRIPTION", margin, y, { font: bold, size: 8, color: MUTED });
  textRight("QTY", colQty, y, { font: bold, size: 8, color: MUTED });
  textRight("UNIT PRICE", colUnit, y, { font: bold, size: 8, color: MUTED });
  textRight("AMOUNT", right, y, { font: bold, size: 8, color: MUTED });
  y -= 10;
  rule(y);
  y -= 20;
  text(`${plan?.name ?? "TagX"} subscription`, margin, y, { size: 10 });
  textRight("1", colQty, y);
  textRight(pdfAmount(payment.amount, payment.currency), colUnit, y);
  textRight(pdfAmount(payment.amount, payment.currency), right, y);
  if (plan) {
    y -= 13;
    text(`Up to ${plan.assetLimit.toLocaleString("en-IN")} assets`, margin, y, { size: 8, color: MUTED });
  }
  y -= 16;
  rule(y);

  // Totals.
  const totals: [string, string, boolean][] = [
    ["Subtotal", pdfAmount(payment.amount, payment.currency), false],
    ["Total", pdfAmount(payment.amount, payment.currency), true],
    ["Amount paid", pdfAmount(paid ? payment.amount : 0, payment.currency), false],
    ["Amount due", pdfAmount(paid ? 0 : payment.amount, payment.currency), true],
  ];
  y -= 20;
  for (const [label, value, strong] of totals) {
    text(label, colQty - 40, y, { font: strong ? bold : regular, size: 10, color: strong ? INK : MUTED });
    textRight(value, right, y, { font: strong ? bold : regular, size: 10 });
    y -= 18;
  }

  // Footer.
  rule(margin + 40);
  const footer = wrap(
    "This is a computer-generated payment receipt and does not need a signature. For a GST tax invoice or billing questions, contact the TagX team.",
    regular,
    8,
    right - margin,
  );
  footer.forEach((line, index) => text(line, margin, margin + 26 - index * 11, { size: 8, color: MUTED }));

  return pdf.save();
}
