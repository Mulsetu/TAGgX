"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

function barcodeDetectorAvailable(): boolean {
  return typeof window !== "undefined" && typeof window.BarcodeDetector === "function";
}

export function QrCameraScanner({ onResult }: { onResult: (value: string) => void }) {
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
          <video ref={videoRef} className="aspect-[3/4] w-full object-cover" playsInline muted autoPlay />
          <Button type="button" variant="secondary" className="rounded-none" size="touch" onClick={() => setOpen(false)}>
            Stop camera
          </Button>
        </div>
      ) : (
        <Button type="button" variant="outline" size="touch" onClick={() => setOpen(true)}>
          Scan with this phone&apos;s camera
        </Button>
      )}
      {error ? <p className="text-sm text-muted-foreground">{error}</p> : null}
      <p className="text-xs text-muted-foreground">
        iPhone: open Camera, point at the sticker, tap the TagX notification. Stay signed in on this
        phone first.
      </p>
    </div>
  );
}
