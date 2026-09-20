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

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      ...(r2PublicHostname ? [{ protocol: "https", hostname: r2PublicHostname }] : []),
      { protocol: "https", hostname: "*.r2.dev" },
      { protocol: "https", hostname: "*.r2.cloudflarestorage.com" },
    ],
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
