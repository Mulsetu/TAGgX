import { describe, expect, it } from "vitest";
import { hasPermission, type PermissionUser } from "./has-permission";

function userWith(assets: PermissionUser["permissions"]["assets"]): PermissionUser {
  return { permissions: { assets } };
}

describe("hasPermission", () => {
  it("grants when the action is directly in the role's permission list", () => {
    const user = userWith(["view", "create"]);
    expect(hasPermission(user, "assets", "view")).toBe(true);
    expect(hasPermission(user, "assets", "create")).toBe(true);
  });

  it("denies when the module isn't in the permission map at all", () => {
    const user: PermissionUser = { permissions: {} };
    expect(hasPermission(user, "assets", "view")).toBe(false);
  });

  it("denies when the action isn't granted and has no fallback", () => {
    const user = userWith(["view"]);
    expect(hasPermission(user, "assets", "delete")).toBe(false);
  });

  it("grants via a configured fallback (e.g. dispose falls back to edit)", () => {
    const user = userWith(["edit"]);
    expect(hasPermission(user, "assets", "dispose")).toBe(true);
    expect(hasPermission(user, "assets", "resolve")).toBe(true);
  });

  it("does not grant a fallback action itself if only the fallback's target is present", () => {
    // 'edit' has no fallback pointing back to 'dispose' — holding only
    // 'dispose' must not imply general edit rights.
    const user = userWith(["dispose"]);
    expect(hasPermission(user, "assets", "edit")).toBe(false);
  });
});
