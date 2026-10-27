import { describe, expect, it } from "vitest";
import { listFiles, read, stripComments } from "../helpers/files";

const SOURCE = listFiles("src", /\.(ts|tsx)$/).filter((file) => !file.endsWith(".test.ts"));

function filesMatching(pattern: RegExp): string[] {
  return SOURCE.filter((file) => pattern.test(stripComments(read(file))));
}

describe("dangerous code patterns", () => {
  it("no eval() or new Function()", () => {
    expect(filesMatching(/\beval\s*\(|new\s+Function\s*\(/)).toEqual([]);
  });

  it("dangerouslySetInnerHTML is only used for JSON-LD built from our own constants", () => {
    // Any new use needs a deliberate review: it bypasses React's escaping.
    const allowed = new Set([
      // JSON-LD from SEO constants in lib/site.ts.
      "src/components/marketing/json-ld.tsx",
      // SVG produced by the qrcode library from a URL; label text goes through escapeXml().
      "src/components/assets/qr-tag.tsx",
    ]);
    expect(filesMatching(/dangerouslySetInnerHTML/).filter((file) => !allowed.has(file))).toEqual([]);
  });

  it("no raw SQL through .rpc('exec_sql') style helpers or template-literal SQL", () => {
    expect(filesMatching(/\.rpc\(\s*["'`](exec_sql|execute_sql|run_sql)/)).toEqual([]);
    // SQL-shaped template literals with interpolation, e.g. `select * from x where id = ${id}`.
    expect(
      filesMatching(/`\s*(select\s[^`]*\sfrom\s|insert\s+into\s|update\s+\w+\s+set\s|delete\s+from\s)[^`]*\$\{/i),
    ).toEqual([]);
  });

  it("no TLS verification bypass", () => {
    expect(filesMatching(/NODE_TLS_REJECT_UNAUTHORIZED|rejectUnauthorized\s*:\s*false/)).toEqual([]);
  });

  it("no `any` type (CLAUDE.md style rule)", () => {
    expect(filesMatching(/:\s*any\b|<any>|as\s+any\b/)).toEqual([]);
  });

  it("links opened in a new tab carry rel=noopener", () => {
    const offenders = SOURCE.filter((file) => {
      const source = stripComments(read(file));
      return Array.from(source.matchAll(/<a\b[^>]*target=["']_blank["'][^>]*>/g)).some((match) => !/noopener|noreferrer/.test(match[0]));
    });
    expect(offenders).toEqual([]);
  });

  it("the cron endpoint compares its secret in constant time", () => {
    const route = read("src/app/api/cron/notifications/route.ts");
    expect(route).toMatch(/timingSafeEqual/);
    expect(route).toMatch(/CRON_SECRET/);
  });
});
