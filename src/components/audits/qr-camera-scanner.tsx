"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";

function barcodeDetectorAvailable(): boolean {
  return typeof window !== "undefined" && typeof window.BarcodeDetector === "function";
}

/** `busy`: the parent is looking up the code that was just read — shown on the Scan button. */
export function QrCameraScanner({ onResult, busy = false }: { onResult: (value: string) => void; busy?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onResultRef = useRef(onResult);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  onResultRef.current = onResult;

  useEffect(() => {
    if (!open) {
      return;
    }

    const videoEl = videoRef.current;
    if (!videoEl) {
      return;
    }

    let stream: MediaStream | null = null;
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    async function start() {
      const video = videoRef.current;
      if (!video) {
        return;
      }

      setError(null);
      if (!barcodeDetectorAvailable() || !window.BarcodeDetector) {
        setError("This browser cannot scan in-page. Use the phone Camera app on the TagX sticker instead.");
        setOpen(false);
        return;
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
      } catch {
        setError("Camera permission was denied. Allow camera, or scan the sticker with the Camera app.");
        return;
      }

      if (cancelled) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      video.srcObject = stream;
      await video.play();

      const Detector = window.BarcodeDetector;
      if (!Detector) {
        return;
      }
      const detector = new Detector({ formats: ["qr_code"] });
      timer = setInterval(() => {
        void detector
          .detect(video)
          .then((codes) => {
            const value = codes[0]?.rawValue?.trim();
            if (!value) {
              return;
            }
            // Short buzz so the person knows the code was read before the lookup returns.
            navigator.vibrate?.(60);
            onResultRef.current(value);
            setOpen(false);
          })
          .catch(() => undefined);
      }, 350);
    }

    void start();

    return () => {
      cancelled = true;
      if (timer) {
        clearInterval(timer);
      }
      stream?.getTracks().forEach((track) => track.stop());
      videoEl.srcObject = null;
    };
  }, [open]);

  return (
    <div className="flex flex-col gap-2">
      {open ? (
        <div className="overflow-hidden rounded-lg border bg-black">
          <div className="relative">
            <video ref={videoRef} className="aspect-[3/4] max-h-[60vh] w-full object-cover" playsInline muted autoPlay />
            {/* Aim frame + live label so it's clear the camera is actively looking. */}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3">
              <div className="aspect-square w-1/2 max-w-56 animate-pulse rounded-2xl border-4 border-white/80" />
              <span className="flex items-center gap-2 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white">
                <Loader2 className="size-3.5 animate-spin" />
                Looking for a QR code…
              </span>
            </div>
          </div>
          <Button type="button" variant="secondary" className="rounded-none" size="touch" onClick={() => setOpen(false)}>
            Stop camera
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          size="touch"
          className="h-14 text-base disabled:opacity-100"
          onClick={() => setOpen(true)}
          disabled={busy}
          aria-busy={busy}
        >
          {busy ? (
            <>
              <Loader2 className="size-5 animate-spin" />
              QR detected — finding asset…
            </>
          ) : (
            <>
              <ScanLine className="size-5" />
              Scan QR code
            </>
          )}
        </Button>
      )}
      {error ? <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{error}</p> : null}
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer select-none">Camera not working?</summary>
        <p className="mt-1">
          Open your phone&apos;s Camera app, point it at the sticker and tap the TagX link (stay signed in on
          this phone). Or type the asset code below.
        </p>
      </details>
    </div>
  );
}
