import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: [
      // See src/test/server-only-stub.ts — lets tests import files
      // marked `import "server-only"` without pulling in Next's build
      // pipeline, as long as the specific function under test doesn't
      // also call a real Next/Supabase API at module scope.
      {
        find: "server-only",
        replacement: fileURLToPath(new URL("./src/test/server-only-stub.ts", import.meta.url)),
      },
      // Server code uses React's request-scoped `cache()`, which Next
      // provides through its bundled React build; plain react@18 has no
      // such export. Resolve bare `react` the same way Next's server does.
      { find: /^react$/, replacement: "next/dist/compiled/react" },
    ],
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
