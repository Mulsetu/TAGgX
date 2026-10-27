import fs from "node:fs";
import path from "node:path";

/** Repo root: every npm script runs from there. */
export const ROOT = process.cwd();

/** All files under `dir` (relative to the repo root) whose names match `pattern`. */
export function listFiles(dir: string, pattern: RegExp): string[] {
  const start = path.join(ROOT, dir);
  if (!fs.existsSync(start)) return [];
  const out: string[] = [];
  const walk = (current: string) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === ".next") continue;
        walk(full);
      } else if (pattern.test(entry.name)) {
        out.push(path.relative(ROOT, full).split(path.sep).join("/"));
      }
    }
  };
  walk(start);
  return out.sort();
}

export function read(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

/** Strips // and /* *\/ comments so commented-out code doesn't trip the checks. */
export function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}
