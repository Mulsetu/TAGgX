import { defineConfig } from "vitest/config";

// Offline security checks (source, migrations, config). No server or database needed.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/security/**/*.test.ts"],
  },
});
