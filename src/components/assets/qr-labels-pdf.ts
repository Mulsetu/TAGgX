"use client";

import QRCode from "qrcode";
import type { QrLabel } from "@/modules/assets/types";

// A4 in PDF points, 3 × 4 labels per page.
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 28;
const COLUMNS = 3;
const ROWS = 4;
const CELL_WIDTH = (PAGE_WIDTH - MARGIN * 2) / COLUMNS;
const CELL_HEIGHT = (PAGE_HEIGHT - MARGIN * 2) / ROWS;

// Each label is rendered to a canvas at this size, then placed in its cell.
const LABEL_PX_WIDTH = 540;
const LABEL_PX_HEIGHT = 640;
const QR_PX = 440;
const TEXT_FONT = "system-ui, -apple-system, 'Segoe UI', 'Noto Sans', 'Noto Sans Devanagari', sans-serif";

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let end = text.length;
  while (end > 0 && ctx.measureText(`${text.slice(0, end)}…`).width > maxWidth) end -= 1;
  return `${text.slice(0, end)}…`;
}

/** Up to two lines, the second ellipsised if the name is still longer. */
function wrapName(ctx: CanvasRenderingContext2D, name: string, maxWidth: number): string[] {
  const words = name.trim().split(/\s+/);
  let first = "";
  let index = 0;
  while (index < words.length) {
    const next = first ? `${first} ${words[index]}` : (words[index] ?? "");
    if (ctx.measureText(next).width > maxWidth) break;
    first = next;
    index += 1;
  }
  if (!first) return [fitText(ctx, name, maxWidth)];
  const rest = words.slice(index).join(" ");
  return rest ? [first, fitText(ctx, rest, maxWidth)] : [first];
}

/**
 * Drawn on a canvas (not as PDF text) so names in any script — Hindi,
 * Tamil, etc. — print correctly without embedding fonts in the PDF.
 */
async function renderLabelPng(label: QrLabel, origin: string): Promise<Uint8Array> {
  const canvas = document.createElement("canvas");
  canvas.width = LABEL_PX_WIDTH;
  canvas.height = LABEL_PX_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser can't draw QR labels.");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const qrCanvas = document.createElement("canvas");
  await QRCode.toCanvas(qrCanvas, `${origin}/tag/${label.id}`, {
    margin: 1,
    width: QR_PX,
    errorCorrectionLevel: "M",
  });
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(qrCanvas, (LABEL_PX_WIDTH - QR_PX) / 2, 8, QR_PX, QR_PX);

  const textWidth = LABEL_PX_WIDTH - 32;
  ctx.fillStyle = "#111827";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  ctx.font = `600 34px ${TEXT_FONT}`;
  let y = QR_PX + 24;
  for (const line of wrapName(ctx, label.name, textWidth)) {
    ctx.fillText(line, LABEL_PX_WIDTH / 2, y);
    y += 42;
  }

  ctx.font = `500 30px ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace`;
  ctx.fillStyle = "#374151";
  ctx.fillText(fitText(ctx, label.assetCode, textWidth), LABEL_PX_WIDTH / 2, y + 6);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Could not draw a QR label.");
  return new Uint8Array(await blob.arrayBuffer());
}

/** Builds an A4 PDF of QR labels (QR, asset name, asset code) and downloads it. */
export async function downloadQrLabelsPdf(
  labels: QrLabel[],
  fileName: string,
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  const { PDFDocument } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  pdf.setTitle("TagX QR labels");
  const origin = window.location.origin;

  const drawWidth = CELL_WIDTH - 12;
  const drawHeight = (drawWidth * LABEL_PX_HEIGHT) / LABEL_PX_WIDTH;
  const scale = Math.min(1, (CELL_HEIGHT - 12) / drawHeight);
  const width = drawWidth * scale;
  const height = drawHeight * scale;
  const perPage = COLUMNS * ROWS;

  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  for (let i = 0; i < labels.length; i += 1) {
    const label = labels[i];
    if (!label) continue;
    const slot = i % perPage;
    if (slot === 0 && i > 0) {
      page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    }
    const column = slot % COLUMNS;
    const row = Math.floor(slot / COLUMNS);
    const cellX = MARGIN + column * CELL_WIDTH;
    const cellTop = PAGE_HEIGHT - MARGIN - row * CELL_HEIGHT;

    const image = await pdf.embedPng(await renderLabelPng(label, origin));
    page.drawImage(image, {
      x: cellX + (CELL_WIDTH - width) / 2,
      y: cellTop - (CELL_HEIGHT + height) / 2,
      width,
      height,
    });
    onProgress?.(i + 1, labels.length);
  }

  const bytes = await pdf.save();
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: "application/pdf" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
