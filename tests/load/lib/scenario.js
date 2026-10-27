// Shared k6 user journey for every load profile in this folder.
//
// Environment:
//   TARGET_URL     required, e.g. http://localhost:3000 or a staging URL
//   AUTH_COOKIE  optional, the full Cookie header of a signed-in TEST account
//                (copy from the browser's dev tools). Adds the signed-in pages.
//   TAG_ID       optional, an asset id whose public /tag/<id> page should be hit
//
// Never point stress/spike/soak/breakpoint at production without warning
// the team — they are designed to push the system until it struggles.

import http from "k6/http";
import { check, group, sleep } from "k6";

export const TARGET_URL = (__ENV.TARGET_URL || "").replace(/\/$/, "");
if (!TARGET_URL) {
  throw new Error("Set TARGET_URL, e.g. k6 run -e TARGET_URL=http://localhost:3000 tests/load/smoke.js");
}

const AUTH_COOKIE = __ENV.AUTH_COOKIE || "";
const TAG_ID = __ENV.TAG_ID || "";

// Budgets: tighten these once real numbers are known (k6 docs recommend
// deriving them from your SLAs rather than copying generic values).
export const THRESHOLDS = {
  http_req_failed: ["rate<0.01"],
  "http_req_duration{kind:public}": ["p(95)<800"],
  "http_req_duration{kind:app}": ["p(95)<1500"],
  checks: ["rate>0.99"],
};

function visit(path, kind, headers = {}) {
  const response = http.get(`${TARGET_URL}${path}`, { headers, tags: { kind, page: path }, redirects: 0 });
  check(response, {
    [`${path} is not a server error`]: (r) => r.status > 0 && r.status < 500,
  });
  return response;
}

export function journey() {
  group("public pages", () => {
    visit("/", "public");
    visit("/login", "public");
    visit("/signup", "public");
    if (TAG_ID) visit(`/tag/${TAG_ID}`, "public");
  });

  if (AUTH_COOKIE) {
    const headers = { cookie: AUTH_COOKIE };
    group("signed-in pages", () => {
      for (const path of [
        "/dashboard",
        "/assets",
        "/assets/new",
        "/dashboard/administration/maintenance",
        "/dashboard/administration/settings/workspace",
        "/dashboard/profile",
      ]) {
        const response = visit(path, "app", headers);
        check(response, { [`${path} stays signed in`]: (r) => r.status === 200 });
      }
    });
  }

  // Think time between page views, like a real person.
  sleep(Math.random() * 2 + 1);
}
