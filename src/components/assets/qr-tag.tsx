"use client";

import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { markQrGeneratedAction } from "@/modules/assets/actions";

interface QrTagProps {
  assetId: string;
  assetCode: string;
  generated: boolean;
}

/**
 * Encodes the public tag URL. Once generated, the timestamp is stored on
 * the asset so this same code is shown again after a reload until the
 * user clicks Regenerate.
 */
export function QrTag({ assetId, assetCode, generated }: QrTagProps) {
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

    const blob = new Blob([svgMarkup], { type: "image/svg+xml" });
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
