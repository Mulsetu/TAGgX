import { defineConfig } from "vitest/config";

// Live checks against a running app. Set TARGET_URL (e.g. http://localhost:3000);
// without it every suite here is skipped.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/http/**/*.test.ts"],
    testTimeout: 20_000,
  },
});
