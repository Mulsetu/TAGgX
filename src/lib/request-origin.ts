import "server-only";
import { headers } from "next/headers";
import { getSiteUrl } from "@/lib/site";

/**
 * Origin of the request that is sending the link. Same idea as a QR tag,
 * which uses the browser's current address: localhost while developing,
 * and the deployed host once the app is opened there.
 */
export function getRequestSiteUrl(): string {
  const headerStore = headers();
  const host = (headerStore.get("x-forwarded-host") ?? headerStore.get("host") ?? "").split(",")[0]?.trim() ?? "";
  if (!host || /[\s/\\]/.test(host)) {
    return getSiteUrl();
  }

  const local = host.startsWith("localhost") || host.startsWith("127.0.0.1") || host.startsWith("[::1]");
  const forwarded = headerStore.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const proto = local ? "http" : forwarded === "http" ? "http" : "https";

  try {
    return new URL(`${proto}://${host}`).origin;
  } catch {
    return getSiteUrl();
  }
}
