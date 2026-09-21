import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      // See src/test/server-only-stub.ts — lets tests import files
      // marked `import "server-only"` without pulling in Next's build
      // pipeline, as long as the specific function under test doesn't
      // also call a real Next/Supabase API at module scope.
      "server-only": fileURLToPath(new URL("./src/test/server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
