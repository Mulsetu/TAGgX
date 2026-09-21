import { describe, expect, it } from "vitest";
import { ACTION_FALLBACKS, FULL_PERMISSIONS, PERMISSION_ACTIONS, PERMISSION_MODULES, parseCapability } from "./taxonomy";

describe("parseCapability", () => {
  it("splits a 'module.action' string into its parts", () => {
    expect(parseCapability("assets.view")).toEqual({ module: "assets", action: "view" });
    expect(parseCapability("roles.edit")).toEqual({ module: "roles", action: "edit" });
  });
});

describe("FULL_PERMISSIONS", () => {
  it("grants every action on every module — the seeded Company Admin role's baseline", () => {
    for (const permissionModule of PERMISSION_MODULES) {
      expect(FULL_PERMISSIONS[permissionModule]).toEqual(PERMISSION_ACTIONS as unknown as string[]);
    }
  });
});

describe("ACTION_FALLBACKS", () => {
  it("only maps to real actions in PERMISSION_ACTIONS", () => {
    for (const [action, fallbacks] of Object.entries(ACTION_FALLBACKS)) {
      expect(PERMISSION_ACTIONS).toContain(action);
      for (const fallback of fallbacks ?? []) {
        expect(PERMISSION_ACTIONS).toContain(fallback);
      }
    }
  });

  it("flattens transitive chains — hasPermission() only does a single-level lookup", () => {
    // If a listed fallback itself has fallbacks (e.g. manage -> configure,
    // and configure -> edit), those deeper targets must also be listed
    // directly on the outer action. hasPermission() does one lookup level
    // (ACTION_FALLBACKS[action], not a recursive walk), so a chain that
    // isn't flattened here would mean a role granted only the deepest
    // permission silently fails a check that should pass.
    for (const [action, fallbacks] of Object.entries(ACTION_FALLBACKS)) {
      for (const fallback of fallbacks ?? []) {
        const transitive = ACTION_FALLBACKS[fallback] ?? [];
        for (const deeper of transitive) {
          expect(
            fallbacks,
            `${action}'s fallback list must also include '${deeper}' (reachable via '${fallback}')`,
          ).toContain(deeper);
        }
      }
    }
  });
});
