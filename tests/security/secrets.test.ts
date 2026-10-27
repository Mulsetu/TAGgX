import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { listFiles, read } from "../helpers/files";

// Patterns for credentials that should never be committed. Values in
// .env.example must stay empty or obvious placeholders.
const SECRET_PATTERNS: [string, RegExp][] = [
  ["Supabase secret/service key", /sb_secret_[A-Za-z0-9_-]{20,}/],
  ["JWT (e.g. service_role key)", /eyJ[A-Za-z0-9_-]{20,}\.eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/],
  ["Brevo API key", /xkeysib-[a-f0-9]{40,}/],
  ["Razorpay live key", /rzp_live_[A-Za-z0-9]{10,}/],
  ["AWS / R2 access key", /AKIA[0-9A-Z]{16}/],
  ["Private key block", /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ["Upstash token", /AX[A-Za-z0-9]{30,}=/],
];

function trackedFiles(): string[] {
  try {
    return execFileSync("git", ["ls-files"], { encoding: "utf8" })
      .split("\n")
      .filter((file) => file && /\.(ts|tsx|js|mjs|json|sql|md|yml|yaml|example)$/.test(file) && !file.endsWith("package-lock.json"));
  } catch {
    return listFiles("src", /\.(ts|tsx)$/);
  }
}

describe("secrets", () => {
  it("no committed file contains a credential", () => {
    const hits: string[] = [];
    for (const file of trackedFiles()) {
      const source = read(file);
      for (const [label, pattern] of SECRET_PATTERNS) {
        if (pattern.test(source)) hits.push(`${file}: ${label}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it(".env files with real values are git-ignored", () => {
    const ignore = read(".gitignore");
    expect(ignore).toMatch(/^\.env$/m);
    expect(ignore).toMatch(/^\.env\*\.local$/m);
  });

  it(".env.example only has empty or placeholder values for secrets", () => {
    const filled = read(".env.example")
      .split(/\r?\n/)
      .filter((line) => /^(.*(SECRET|TOKEN|KEY|PASSWORD).*)=(.+)$/.test(line))
      .filter((line) => !/=(placeholder|changeme|your[-_]|<)/i.test(line));
    expect(filled).toEqual([]);
  });

  it("secret env vars are never exposed to the browser as NEXT_PUBLIC_*", () => {
    const exposed = listFiles("src", /\.(ts|tsx)$/).flatMap((file) =>
      Array.from(read(file).matchAll(/NEXT_PUBLIC_[A-Z0-9_]*(SECRET|SERVICE_ROLE|PRIVATE|TOKEN|PASSWORD)[A-Z0-9_]*/g)).map(
        (match) => `${file}: ${match[0]}`,
      ),
    );
    expect(exposed).toEqual([]);
  });
});
