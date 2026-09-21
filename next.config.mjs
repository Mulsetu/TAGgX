// Company logos and asset images/attachments are served from R2. Once
// R2_PUBLIC_URL is set, next/image only needs to allow that exact host;
// the wildcard patterns are just a fallback for local dev before it's set.
const r2PublicHostname = (() => {
  try {
    return process.env.R2_PUBLIC_URL ? new URL(process.env.R2_PUBLIC_URL).hostname : null;
  } catch {
    return null;
  }
})();

// CSP connect-src needs the Supabase project origin: the browser client
// (src/lib/supabase/client.ts) talks to it directly for auth/session calls,
// not through our own API routes.
const supabaseOrigin = (() => {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin : null;
  } catch {
    return null;
  }
})();

// Wildcarded to *.razorpay.com rather than enumerating checkout/api/cdn/
// lumberjack subdomains individually: Razorpay's checkout widget (loaded
// from checkout.razorpay.com — see open-razorpay-checkout.ts) pulls in
// several of its own subdomains for the card iframe and its analytics
// beacon, and an incomplete allowlist here fails silently as a broken
// payment flow, not a console error anyone notices until a customer
// reports a stuck checkout.
const CSP_DIRECTIVES = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://*.razorpay.com`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https://*.r2.dev https://*.r2.cloudflarestorage.com https://*.razorpay.com${r2PublicHostname ? ` https://${r2PublicHostname}` : ""}`,
  "font-src 'self' data:",
  `connect-src 'self' https://*.razorpay.com${supabaseOrigin ? ` ${supabaseOrigin} wss://${new URL(supabaseOrigin).host}` : ""}`,
  "frame-src https://*.razorpay.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      ...(r2PublicHostname ? [{ protocol: "https", hostname: r2PublicHostname }] : []),
      { protocol: "https", hostname: "*.r2.dev" },
      { protocol: "https", hostname: "*.r2.cloudflarestorage.com" },
    ],
    // AVIF dropped from the default ['image/avif', 'image/webp']: a
    // critical (CVSS 9.5) RCE in the libheif/sharp AVIF path is unfixed on
    // this pinned Next 14.2.35 (fixed only in 15.5.24+/16.3.3+ — see
    // GHSA-2xp9-vwfh-vxw4). Its own stated interim mitigation, pending
    // that upgrade, is exactly this: don't let the optimizer touch AVIF.
    // WebP output is unaffected and has equivalent browser support.
    formats: ["image/webp"],
  },
  async headers() {
    const headers = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      // Camera stays same-origin for the floor-audit QR scanner
      // (src/components/audits/qr-camera-scanner.tsx); every other
      // sensitive permission is denied outright.
      {
        key: "Permissions-Policy",
        value: "camera=(self), microphone=(), geolocation=(), payment=(self)",
      },
      { key: "Content-Security-Policy", value: CSP_DIRECTIVES },
    ];

    // HSTS only in production: it forces HTTPS for the origin (and, with
    // includeSubDomains, every subdomain) for the given max-age regardless
    // of what the server does next, which breaks plain-http localhost in
    // some browsers during `next dev`. No `preload` — submitting to
    // browsers' built-in preload list is a separate, hard-to-reverse step
    // that should be a deliberate operator decision, not a default here.
    if (process.env.NODE_ENV === "production") {
      headers.push({
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains",
      });
    }

    return [{ source: "/:path*", headers }];
  },
  webpack: (config) => {
    // Purely informational ("big strings impact deserialization
    // performance") — not a bug, just webpack's persistent build cache
    // logging at "warn" level. Raising the infrastructure log level to
    // "error" silences it without disabling the cache.
    config.infrastructureLogging = { level: "error" };
    return config;
  },
};

export default nextConfig;
