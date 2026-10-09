"use client";

import { useEffect, useState } from "react";

const DEFAULT_TIME_ZONE = "Asia/Kolkata";

const FORMATS = {
  datetime: { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" },
  date: { day: "numeric", month: "short", year: "numeric" },
  time: { hour: "numeric", minute: "2-digit" },
} satisfies Record<string, Intl.DateTimeFormatOptions>;

function format(iso: string, mode: keyof typeof FORMATS, timeZone: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", { ...FORMATS[mode], timeZone }).format(date);
}

/**
 * Timestamps are stored in UTC. Server-rendered toLocaleString() used the
 * server's zone (UTC), so times showed 5h30m behind for Indian users. This
 * renders in IST on the server (deterministic, so hydration matches), then
 * re-formats in the viewer's own time zone once mounted.
 */
export function LocalTime({
  iso,
  mode = "datetime",
  className,
}: {
  iso: string;
  mode?: keyof typeof FORMATS;
  className?: string;
}) {
  const [timeZone, setTimeZone] = useState(DEFAULT_TIME_ZONE);

  useEffect(() => {
    const viewer = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (viewer) setTimeZone(viewer);
  }, []);

  return (
    <time dateTime={iso} className={className} title={format(iso, "datetime", timeZone)}>
      {format(iso, mode, timeZone)}
    </time>
  );
}
