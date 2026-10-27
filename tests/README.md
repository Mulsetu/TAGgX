# Test suites

Unit tests live next to the code (`src/**/*.test.ts`, `npm test`) and run in CI.
This folder holds the suites that check the system as a whole: security,
the database, scalability and a vulnerability scan. Run them in this order.

```
tests/
  security/        offline checks of source, migrations and config     npm run test:security
  http/            live checks against a running app                    npm run test:http
  load/            k6 load profiles                                     npm run test:load:<profile>
  dast/            OWASP ZAP baseline scan                              npm run test:dast
  helpers/         shared helpers for the Vitest suites
supabase/tests/database/   pgTAP RLS tests (Supabase CLI convention)    npm run test:db
```

| # | Suite | Needs | Time | Run when |
| --- | --- | --- | --- | --- |
| 1 | `test:security` | nothing | seconds | every change (safe to add to CI) |
| 2 | `test:deps` | nothing | seconds | weekly, and before each release |
| 3 | `test:http` | a running app | < 1 min | before each release |
| 4 | `test:db` | Docker + Supabase CLI | ~1 min | after every migration |
| 5 | `test:load:smoke` | k6 + a running app | 1 min | before any other load test |
| 6 | `test:dast` | Docker + a running app | ~5 min | before each release |
| 7 | other `test:load:*` | k6 + **staging** | 5 min – hours | before launches / big changes |

## 1. Offline security checks — `npm run test:security`

No server, database or network. Fails if:

- a page or component imports `@supabase/*` or a module's `queries.ts`/`mutations.ts` (skipping permission checks in `actions.ts`)
- the service-role client is reachable from a client component
- any migration table lacks `enable row level security` or a policy, or has a blanket `using (true)` write policy
- a credential (Supabase/Brevo/Razorpay/AWS key, JWT, private key) is committed, or a secret is exposed as `NEXT_PUBLIC_*`
- `eval`, new `dangerouslySetInnerHTML`, SQL built from template strings, TLS bypasses, `any`, or `target="_blank"` without `rel="noopener"` appear
- `next.config.mjs` loses a security header or CSP directive

A new allowlist entry needs a written reason next to it.

## 2. Dependency audit — `npm run test:deps`

`npm audit` on production dependencies, failing on **high** or **critical**.
Fix with `npm audit fix`, or upgrade the package. Note any accepted risk in the README's "Known gaps".

## 3. Live HTTP security checks — `npm run test:http`

```bash
npm run build && npm run start          # terminal 1
TARGET_URL=http://localhost:3000 npm run test:http      # terminal 2
# PowerShell:  $env:TARGET_URL="http://localhost:3000"; npm run test:http
```

Checks the responses a real server sends: OWASP secure headers, no `X-Powered-By`,
no wildcard CORS, every private page and `/admin` redirect signed-out visitors,
spoofed tenant headers and forged cookies don't grant access, the cron endpoint
needs its secret, path traversal on `/api/media`, hostile `/tag/<id>` input, open
redirects, reflected XSS, error pages without stack traces, and no `.env`/`.git` exposure.
Without `TARGET_URL` the suite is skipped, not failed. Point it at staging too.

## 4. Database RLS tests — `npm run test:db`

```bash
supabase start          # local stack in Docker (first time: supabase init)
npm run test:db         # runs supabase/tests/**/*.sql with pgTAP
```

Checks the real database, not the files: RLS on every table, a policy on every
table, a company-scoped policy on every tenant table, no anon policies on tenant
tables, `search_path` pinned on `SECURITY DEFINER` functions, and that a signed-in
stranger and a signed-out visitor see **zero** tenant rows. Seed data first for
the strongest result. Everything runs in a transaction and is rolled back.

## 5. Load tests — `npm run test:load:<profile>`

Install k6: <https://grafana.com/docs/k6/latest/set-up/install-k6/> (Windows: `winget install k6`),
or run it through Docker with nothing installed:

```bash
docker run --rm -v "$PWD/tests/load:/scripts:ro" --add-host=host.docker.internal:host-gateway \
  -e TARGET_URL=http://host.docker.internal:3000 grafana/k6:0.54.0 run /scripts/smoke.js
```

```bash
TARGET_URL=https://staging.example TARGET_VUS=50 npm run test:load:average
```

| Profile | Shape | Question it answers |
| --- | --- | --- |
| `smoke` | 2 users, 1 min | Does the script work? Run first, always. |
| `average` | ramp to `TARGET_VUS`, hold 20 min | Is normal traffic fast enough? |
| `stress` | 3× `TARGET_VUS` | Does it slow down gracefully instead of failing? |
| `spike` | jump to `SPIKE_VUS` (300) in 1 min | Does it survive and recover from a burst? |
| `soak` | `TARGET_VUS` for `SOAK_DURATION` (4h) | Memory leaks or slow degradation? |
| `breakpoint` | ramp to `MAX_RPS` until errors > 5% | Where is the real limit? |

Optional: `AUTH_COOKIE` (Cookie header of a signed-in **test** account) adds the
dashboard, assets, maintenance, settings and profile pages; `TAG_ID` adds a public
QR page. Budgets (p95 < 800 ms public / 1.5 s signed-in, < 1% errors) are in
`load/lib/scenario.js`; tighten them once you have real numbers.

**Only run stress, spike, soak and breakpoint against staging.** They are meant
to push the system until it struggles, and they also load Supabase, R2 and your
hosting plan's limits. While they run, watch Supabase (Reports → API / Database)
and your hosting dashboard; that is where the real bottleneck shows up.

## 6. Vulnerability scan (DAST) — `npm run test:dast`

```bash
TARGET_URL=http://localhost:3000 npm run test:dast
```

Runs the OWASP ZAP **baseline** scan in Docker (`zaproxy/zap-stable`): it crawls the
site for ~2 minutes and reports passive findings. It does not attack the site. Report: `tests/dast/report/zap-report.html`
(git-ignored). Rules and their FAIL/WARN/IGNORE levels are in `dast/zap-rules.tsv`.
`localhost` is rewritten to `host.docker.internal` automatically.

For a deeper, **active** scan (it sends attack payloads), run `zap-full-scan.py`
from the same image against staging only, never production.

## What these suites don't cover

- Business-logic authorization (e.g. "a Viewer can't edit an asset") needs signed-in
  test accounts per role. Add Playwright end-to-end tests when that's needed.
- Payments: test with Razorpay test mode, not with these suites.
- A professional penetration test before handling sensitive customer data at scale.
