import { describe, expect, it } from "vitest";
import { listFiles, read, stripComments } from "../helpers/files";

// CLAUDE.md layering: View (app/, components/) -> actions.ts -> queries/mutations -> DB.
// A page that talks to the database directly skips the permission and
// validation checks that live in actions.ts.

const VIEW_FILES = [...listFiles("src/app", /\.(ts|tsx)$/), ...listFiles("src/components", /\.(ts|tsx)$/)];
// `import type` is erased at build time and can't reach the database, so it's not counted.
const SUPABASE_IMPORT = /import\s+(?!type\s)[^;]*?from\s+["']@supabase\//;
const MODEL_IMPORT = /from\s+["']@\/modules\/[^"']+\/(queries|mutations)["']/;

describe("layering", () => {
  it("no page or component imports @supabase/* directly", () => {
    const offenders = VIEW_FILES.filter((file) => SUPABASE_IMPORT.test(stripComments(read(file))));
    expect(offenders).toEqual([]);
  });

  it("no page or component imports a module's queries.ts or mutations.ts", () => {
    const offenders = VIEW_FILES.filter((file) => MODEL_IMPORT.test(stripComments(read(file))));
    expect(offenders).toEqual([]);
  });

  it("@supabase/* is only imported from lib/supabase and module queries/mutations", () => {
    const allowed = /^src\/(lib\/supabase\/|modules\/[^/]+\/(queries|mutations)\.ts$)/;
    // middleware.ts builds its own client through lib/supabase/middleware.ts.
    const offenders = listFiles("src", /\.(ts|tsx)$/).filter(
      (file) => !allowed.test(file) && !file.endsWith(".test.ts") && SUPABASE_IMPORT.test(stripComments(read(file))),
    );
    expect(offenders).toEqual([]);
  });

  it("the service-role (admin) Supabase client never reaches client components", () => {
    const offenders = VIEW_FILES.filter((file) => {
      const source = read(file);
      return /^\s*["']use client["']/.test(source) && /lib\/supabase\/admin/.test(source);
    });
    expect(offenders).toEqual([]);
  });

  it("every module actions.ts is a server-only entry point", () => {
    const missing = listFiles("src/modules", /^actions\.ts$/).filter((file) => {
      const head = read(file).slice(0, 400);
      return !/["']use server["']/.test(head) && !/import\s+["']server-only["']/.test(head);
    });
    expect(missing).toEqual([]);
  });
});
