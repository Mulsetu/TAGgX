"use client";

import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { markQrGeneratedAction } from "@/modules/assets/actions";

interface QrTagProps {
  assetId: string;
  assetName: string;
  assetCode: string;
  generated: boolean;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Splits a name into at most two ~28-character lines, ellipsising the rest. */
function nameLines(name: string, max = 28): string[] {
  const words = name.trim().split(/\s+/);
  let first = "";
  let index = 0;
  while (index < words.length && `${first} ${words[index]}`.trim().length <= max) {
    first = `${first} ${words[index]}`.trim();
    index += 1;
  }
  if (!first) return [name.length > max ? `${name.slice(0, max - 1)}…` : name];
  const rest = words.slice(index).join(" ");
  if (!rest) return [first];
  return [first, rest.length > max ? `${rest.slice(0, max - 1)}…` : rest];
}

/** Printable label: the QR with the asset name and code underneath, like the bulk PDF. */
function labelSvg(qrSvg: string, name: string, code: string): string {
  const size = 240;
  const lines = nameLines(name);
  const height = size + 16 + lines.length * 20 + 26;
  // Re-size the qrcode package's own <svg> (it carries width/height already) and nest it.
  const inner = qrSvg
    .replace(/^<svg([^>]*?) width="[^"]*"/, "<svg$1")
    .replace(/^<svg([^>]*?) height="[^"]*"/, "<svg$1")
    .replace("<svg ", `<svg x="0" y="0" width="${size}" height="${size}" `);
  const nameText = lines
    .map(
      (line, i) =>
        `<text x="${size / 2}" y="${size + 18 + i * 20}" text-anchor="middle" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" font-size="16" font-weight="600" fill="#111827">${escapeXml(line)}</text>`,
    )
    .join("");
  const codeText = `<text x="${size / 2}" y="${size + 18 + lines.length * 20 + 4}" text-anchor="middle" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="14" fill="#374151">${escapeXml(code)}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${height}" viewBox="0 0 ${size} ${height}"><rect width="100%" height="100%" fill="#ffffff"/>${inner}${nameText}${codeText}</svg>`;
}

/**
 * Encodes the public tag URL. Once generated, the timestamp is stored on
 * the asset so this same code is shown again after a reload until the
 * user clicks Regenerate.
 */
export function QrTag({ assetId, assetName, assetCode, generated }: QrTagProps) {
  const [svgMarkup, setSvgMarkup] = useState<string | null>(null);
  const [tagUrl, setTagUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPersisted, setIsPersisted] = useState(generated);

  const renderQr = useCallback(async () => {
    const url = `${window.location.origin}/tag/${assetId}`;
    const svg = await QRCode.toString(url, {
      type: "svg",
      margin: 2,
      width: 240,
    });
    setTagUrl(url);
    setSvgMarkup(svg);
  }, [assetId]);

  useEffect(() => {
    if (!generated) {
      return;
    }

    void renderQr();
  }, [generated, renderQr]);

  async function handleGenerate() {
    setIsGenerating(true);
    setCopied(false);
    setError(null);
    try {
      await renderQr();
      const result = await markQrGeneratedAction(assetId);
      if (result.error) {
        setError(result.error);
        return;
      }
      setIsPersisted(true);
    } finally {
      setIsGenerating(false);
    }
  }

  function handleDownload() {
    if (!svgMarkup) return;

    const blob = new Blob([labelSvg(svgMarkup, assetName, assetCode)], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${assetCode}-qr.svg`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleCopy() {
    if (!tagUrl) return;
    try {
      await navigator.clipboard.writeText(tagUrl);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const showQr = Boolean(svgMarkup);
  const label = isGenerating
    ? isPersisted
      ? "Regenerating..."
      : "Generating..."
    : isPersisted
      ? "Regenerate QR"
      : "Generate QR";

  return (
    <div className="flex flex-col items-start gap-3">
      {showQr ? (
        // Safe: svgMarkup is generated deterministically by the qrcode
        // package from a URL we built ourselves, not arbitrary user input.
        <div
          className="w-fit rounded-md border bg-white p-3 [&_svg]:h-40 [&_svg]:w-40"
          dangerouslySetInnerHTML={{ __html: svgMarkup ?? "" }}
        />
      ) : generated ? (
        <p className="text-xs text-muted-foreground">Loading QR…</p>
      ) : null}
      {tagUrl ? (
        <div className="flex max-w-full flex-col gap-1.5">
          <p className="text-xs font-medium text-muted-foreground">Tag link</p>
          <a href={tagUrl} className="break-all text-sm text-primary hover:underline" target="_blank" rel="noreferrer">
            {tagUrl}
          </a>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={handleGenerate} disabled={isGenerating}>
          {label}
        </Button>
        {showQr ? (
          <Button type="button" variant="outline" onClick={handleDownload}>
            Download SVG
          </Button>
        ) : null}
        {tagUrl ? (
          <Button type="button" variant="outline" onClick={handleCopy}>
            {copied ? "Copied" : "Copy link"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
