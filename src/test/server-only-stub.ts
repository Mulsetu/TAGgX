// Vitest alias target for "server-only" (see vitest.config.mts). That
// package's real implementation unconditionally throws when imported
// outside Next's own build pipeline, which is exactly what running a
// file's pure, non-Next-specific logic under a plain test runner needs to
// do. Next's webpack/turbopack build still uses the real package — this
// stub is Vitest-only.
export {};
