/**
 * Live-server helpers. Point TARGET_URL at a running app, e.g.
 *   npm run build && npm run start            (then)
 *   TARGET_URL=http://localhost:3000 npm run test:http
 * Without TARGET_URL the HTTP suites are skipped, not failed.
 */
export const TARGET_URL = (process.env.TARGET_URL ?? "").replace(/\/$/, "");
export const HAS_SERVER = TARGET_URL.length > 0;

export function url(path: string): string {
  return `${TARGET_URL}${path}`;
}

/** GET without following redirects, so guards can be asserted on the 3xx itself. */
export function get(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(url(path), { redirect: "manual", ...init });
}

export function isRedirect(response: Response): boolean {
  return response.status >= 300 && response.status < 400;
}

/** Resolved Location header, or null. */
export function location(response: Response): URL | null {
  const value = response.headers.get("location");
  return value ? new URL(value, TARGET_URL) : null;
}
