import { describe, expect, it } from "vitest";
import { read } from "../helpers/files";

// Static check of next.config.mjs. tests/http/security-headers.test.ts
// checks the headers a running server actually sends.
const config = read("next.config.mjs");

describe("security headers configured in next.config.mjs", () => {
  it.each([
    ["X-Content-Type-Options", /X-Content-Type-Options["'],\s*value:\s*["']nosniff/],
    ["X-Frame-Options", /X-Frame-Options["'],\s*value:\s*["'](DENY|SAMEORIGIN)/],
    ["Referrer-Policy", /Referrer-Policy["'],\s*value:\s*["']strict-origin-when-cross-origin|no-referrer/],
    ["Permissions-Policy", /Permissions-Policy/],
    ["Content-Security-Policy", /Content-Security-Policy/],
    ["Strict-Transport-Security", /Strict-Transport-Security/],
  ])("sets %s", (_name, pattern) => {
    expect(config).toMatch(pattern);
  });

  it.each([
    ["object-src 'none'", /object-src 'none'/],
    ["base-uri 'self'", /base-uri 'self'/],
    ["frame-ancestors", /frame-ancestors/],
    ["form-action", /form-action 'self'/],
    ["default-src 'self'", /default-src 'self'/],
  ])("CSP includes %s", (_name, pattern) => {
    expect(config).toMatch(pattern);
  });

  it("only allows 'unsafe-eval' outside production", () => {
    expect(config).toMatch(/NODE_ENV === "production" \? "" : "'unsafe-eval'"/);
  });

  it("applies the headers to every path", () => {
    expect(config).toMatch(/source:\s*["']\/:path\*["']/);
  });
});
