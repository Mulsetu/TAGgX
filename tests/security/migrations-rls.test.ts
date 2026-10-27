import { describe, expect, it } from "vitest";
import { listFiles, read } from "../helpers/files";

// CLAUDE.md: "RLS is enforced on every table, no exceptions." These checks
// read the migration files, so they catch a missing policy before it ships.
// tests/database/rls.test.sql checks the same thing against a live database.

const SQL = listFiles("supabase/migrations", /\.sql$/)
  .map((file) => read(file).replace(/--.*$/gm, ""))
  .join("\n")
  .toLowerCase();

function bare(name: string): string {
  return name.replace(/^public\./, "").replace(/"/g, "");
}

const createdTables = new Set(
  Array.from(SQL.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?((?:public\.)?"?[a-z0-9_]+"?)/g)).map((match) => bare(match[1]!)),
);
const droppedTables = new Set(
  Array.from(SQL.matchAll(/drop\s+table\s+(?:if\s+exists\s+)?((?:public\.)?"?[a-z0-9_]+"?)/g)).map((match) => bare(match[1]!)),
);
const liveTables = Array.from(createdTables).filter((table) => !droppedTables.has(table)).sort();
const rlsEnabled = new Set(
  Array.from(SQL.matchAll(/alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?((?:public\.)?"?[a-z0-9_]+"?)\s+enable\s+row\s+level\s+security/g)).map(
    (match) => bare(match[1]!),
  ),
);
const withPolicy = new Set(
  Array.from(SQL.matchAll(/create\s+policy\s+(?:"[^"]+"|[a-z0-9_]+)\s+on\s+((?:public\.)?"?[a-z0-9_]+"?)/g)).map((match) => bare(match[1]!)),
);

describe("row level security in migrations", () => {
  it("finds the migration tables (sanity check for the parser)", () => {
    expect(liveTables.length).toBeGreaterThan(5);
  });

  it("every table enables row level security", () => {
    expect(liveTables.filter((table) => !rlsEnabled.has(table))).toEqual([]);
  });

  it("every table has at least one policy", () => {
    expect(liveTables.filter((table) => !withPolicy.has(table))).toEqual([]);
  });

  it("no migration grants table access to the anon role wholesale", () => {
    expect(SQL).not.toMatch(/grant\s+all\s+on\s+all\s+tables\s+in\s+schema\s+public\s+to\s+anon/);
  });

  it("no policy is a blanket `using (true)` for writes", () => {
    const blanketWrites = Array.from(
      SQL.matchAll(/create\s+policy[^;]*?for\s+(insert|update|delete|all)[^;]*?(using|with\s+check)\s*\(\s*true\s*\)/g),
    ).map((match) => match[0].slice(0, 120));
    expect(blanketWrites).toEqual([]);
  });
});
