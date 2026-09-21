import { describe, expect, it } from "vitest";
import { safePostLoginPath } from "./paths";

// Regression coverage for the open-redirect guard: a crafted `?next=`
// value must never send a signed-in user off tagx.mulsetu.com.
describe("safePostLoginPath", () => {
  it("allows the known in-app destinations", () => {
    expect(safePostLoginPath("/dashboard")).toBe("/dashboard");
    expect(safePostLoginPath("/floor")).toBe("/floor");
    expect(safePostLoginPath("/onboarding")).toBe("/onboarding");
    expect(safePostLoginPath("/dashboard/administration/users")).toBe("/dashboard/administration/users");
    expect(safePostLoginPath("/assets/new")).toBe("/assets/new");
  });

  it("allows a direct asset/tag UUID path", () => {
    expect(safePostLoginPath("/assets/11111111-2222-3333-4444-555555555555")).toBe(
      "/assets/11111111-2222-3333-4444-555555555555",
    );
    expect(safePostLoginPath("/tag/11111111-2222-3333-4444-555555555555")).toBe(
      "/tag/11111111-2222-3333-4444-555555555555",
    );
  });

  it("rejects protocol-relative URLs (off-site redirect via //host)", () => {
    expect(safePostLoginPath("//evil.example.com")).toBeNull();
    expect(safePostLoginPath("//evil.example.com/dashboard")).toBeNull();
  });

  it("rejects absolute URLs to another host", () => {
    expect(safePostLoginPath("https://evil.example.com/dashboard")).toBeNull();
    expect(safePostLoginPath("http://evil.example.com")).toBeNull();
  });

  it("rejects paths outside the explicit allow-list", () => {
    expect(safePostLoginPath("/admin")).toBeNull();
    expect(safePostLoginPath("/some-random-path")).toBeNull();
    expect(safePostLoginPath("/")).toBeNull();
  });

  it("rejects path traversal and backslash tricks", () => {
    expect(safePostLoginPath("/dashboard/../../etc/passwd")).toBeNull();
    expect(safePostLoginPath("/dashboard\\@evil.com")).toBeNull();
  });

  it("rejects empty, undefined, and non-path input", () => {
    expect(safePostLoginPath(undefined)).toBeNull();
    expect(safePostLoginPath("")).toBeNull();
    expect(safePostLoginPath("dashboard")).toBeNull();
  });

  it("takes the first value when given an array (repeated ?next= params)", () => {
    expect(safePostLoginPath(["/dashboard", "//evil.example.com"])).toBe("/dashboard");
    expect(safePostLoginPath(["//evil.example.com", "/dashboard"])).toBeNull();
  });
});
