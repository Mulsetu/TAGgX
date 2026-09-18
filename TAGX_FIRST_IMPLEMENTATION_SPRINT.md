# TagX First Implementation Sprint

**Status:** Planned. Do not implement until this sprint is approved.

**Goal:** Close P0 access-control holes on the existing platform. Do not rebuild KEEP features. Do not add departments, workflows, PDF, or a vendor portal app.

**Duration (suggested):** 5–8 working days.

**In scope:** TAGX-001, TAGX-002, TAGX-003, TAGX-004, TAGX-005, TAGX-006, TAGX-007, TAGX-008, TAGX-009.

**Out of scope (Phase 1 sprint 1b):** TAGX-010 … TAGX-018 (xlsx, vendor FK, required docs, email retry, photos, invite hash, media auth, subscription/suspension).

**Architecture constraints (KEEP):** View → `actions.ts` → queries/mutations. No `@supabase/*` in `app/` or `components/`. Zod before model. Derive `company_id` / role from session. No new domain folders unless a task below requires a tiny helper (prefer `src/lib/permissions`).

---

## Sprint outcomes

After this sprint:

1. Deactivated users cannot log in or keep a session.
2. Tenant feature flags block pages and mutations, including audits.
3. Admin/asset GET actions and direct URLs require `view` (or equivalent).
4. Roles UI is not readable without `roles.view`.
5. `/floor/**` requires the audits module and `audits.view`.
6. Vendor-scoped users get a reduced shell and cannot open staff admin URLs.
7. Login is rate-limited (in-process).
8. Cron creates PM tickets before sending due emails.
9. `.env.example` documents `CRON_SECRET` and contains placeholders only.
10. Super admins no longer treat all tenant modules as enabled inside `/dashboard` and `/floor`.

---

## Shared helpers (do once, reuse)

Add small helpers rather than copying checks:

- `assertPermission(module, action)` — redirect or throw/return for pages vs actions
- `assertModule(feature)` — same for `enabled_modules`
- `getVendorScope()` — `users.vendor_id` for the session

Prefer extending `src/lib/permissions/has-permission.ts` and `features.ts`. No new permission modules in this sprint (taxonomy KEEP).

Rollback: revert the helper and call sites; no migration in this sprint.

---

## Task 1 — Block deactivated users (TAGX-001)

### Objective
Honor `users.is_active` at login and on every authenticated request.

### Current problem
`signIn` loads `company_id` only. `toggleUserActiveAction` is cosmetic for access.

### Expected result
Inactive users get the same generic failure as a bad password. An already-open session is signed out on the next middleware pass.

### Files to inspect
- `src/modules/users/actions.ts` (`signIn`, `toggleUserActiveAction`)
- `src/modules/users/queries.ts`
- `src/middleware.ts`
- `src/lib/supabase/middleware.ts`

### Files likely to change
- `src/modules/users/actions.ts`
- `src/middleware.ts`

### Database changes
None.

### Permission changes
None.

### UI changes
None required. Optional: user list copy “Inactive users cannot sign in.”

### Test cases
- Active user, correct password, matching slug → dashboard
- Inactive user, correct password → error, no session cookie
- Inactive user with leftover cookies → redirected to login, session cleared
- Wrong company still “No account was found for this company.”
- Super-admin `/admin/login` unchanged (no `users.is_active`)

### Acceptance criteria
- [ ] `signIn` selects `is_active` and signs out if false
- [ ] Middleware signs out inactive tenant profiles
- [ ] No new table or migration

### Rollback
Revert the two files. Users can sign in again regardless of flag (current production behavior).

---

## Task 2 — Module enforcement including audits (TAGX-002, TAGX-009)

### Objective
Disabled modules cannot be used via URL or action. Super-admin bypass applies to RBAC, not tenant feature flags, on tenant routes.

### Current problem
Nav hides modules. `createAuditAction` / scan / complete / delete skip `requireModule("audits")`. `isModuleEnabled` returns true for super admins.

### Expected result
`requireModule` on every mutating and listing action for `maintenance`, `audits`, `vendors`, `handover`, `preventive_maintenance`, `reports`. Pages redirect to `/dashboard` when the flag is off. `/admin` does not use tenant flags.

### Files to inspect
- `src/lib/permissions/features.ts`
- `src/lib/permissions/admin-sections.ts`
- `src/modules/audits/actions.ts`
- `src/modules/maintenance/actions.ts`
- `src/modules/vendors/actions.ts`
- `src/modules/reports/actions.ts`
- `src/modules/custody/actions.ts`
- Audit/maintenance/vendors/reports/floor pages

### Files likely to change
- `features.ts` (remove super-admin true-bypass in `isModuleEnabled`)
- All feature `actions.ts` listed above
- Admin and floor pages (redirect)

### Database changes
None (`enabled_modules` exists).

### Permission changes
None in taxonomy. Policy change only: super admin still passes `requirePermission`.

### UI changes
None beyond redirect. Settings module toggles KEEP.

### Test cases
- Company with `audits: false`: staff with `audits.create` cannot create or open audit pages
- `handover: false`: custody actions fail; asset form still edits other fields
- Super admin `/admin/plans` still loads
- Super admin opening `/dashboard/administration/audits` for a company with audits off is denied (if they have a tenant session)

### Acceptance criteria
- [ ] Every audit action calls `requireModule("audits")`
- [ ] Tenant `isModuleEnabled` does not short-circuit for super admins
- [ ] Disabled module pages redirect

### Rollback
Restore `isModuleEnabled` super-admin bypass if `/admin` was accidentally broken (it should not use that helper).

---

## Task 3 — GET permission gates and direct URL deny (TAGX-003, TAGX-004)

### Objective
Reads use the same RBAC as writes. Direct URLs do not render privileged children.

### Current problem
Verified unguarded GETs: roles, users, pending invites, statuses, conditions, categories, maintenance tickets, assets list/detail, workspace settings. Users/roles layout still renders `children` when tabs are empty.

### Expected result
Each GET returns `[]` / `null` without permission. Pages with no `view` redirect to `/dashboard`. Roles layout redirects if `roles.view` is missing on the roles URL (and likewise users).

### Files to inspect
- `src/modules/roles/actions.ts` — `getRolesForAdministration`
- `src/modules/users/actions.ts` — `getCompanyUsersForAdmin`, `getPendingInvitesForAdmin`
- `src/modules/statuses/actions.ts` — `getStatusesForAdmin`
- `src/modules/conditions/actions.ts` — `getConditionsForAdmin`
- `src/modules/categories/actions.ts` — `getCategoriesForAdmin`, field getters used by admin
- `src/modules/maintenance/actions.ts` — `getMaintenanceTicketsForAdmin`
- `src/modules/assets/actions.ts` — `getAssetsForList`, `getAssetDetail`, form/filter/attachment getters
- `src/modules/companies/actions.ts` — `getWorkspaceSettingsForAdmin`
- `src/modules/custody/actions.ts` — lifecycle/pending ack getters
- `src/app/(dashboard)/dashboard/administration/(users-and-roles)/layout.tsx`
- Other admin `page.tsx` files that do not check view today

### Files likely to change
All of the above actions plus pages/layouts that should `redirect`.

### Database changes
None.

### Permission changes
Use existing `view` (assets list/detail: `assets.view`; new asset page: `assets.create` or view+create). Do not invent keys.

### UI changes
Empty vs forbidden: prefer redirect so we do not show a blank “no data” admin screen.

### Test cases
- Role without `roles.view`: `/dashboard/administration/roles` redirects; `getRolesForAdministration` is `[]`
- Role with `roles.view` but not `users.view`: users tab hidden and users URL redirected
- `assets.view` false: `/assets` and `/assets/[id]` denied
- `assets.create` false: `/assets/new` denied even if view is true
- Admin with full map: all pages still load

### Acceptance criteria
- [ ] No tenant admin GET listed above skips `requirePermission`
- [ ] Layouts do not render privileged `children` without view
- [ ] Mutations remain gated (no regression)

### Rollback
Revert action guards; RLS still isolates tenants.

---

## Task 4 — Floor audit layout gate (TAGX-005)

### Objective
`/floor/**` is an auditor surface, not a generic authenticated area.

### Current problem
`src/app/(floor)/floor/layout.tsx` only checks a session.

### Expected result
Redirect to `/dashboard` unless audits module is on and `audits.view` is true.

### Files to inspect
- `src/app/(floor)/floor/layout.tsx`
- `src/modules/audits/actions.ts` (list/scan already check view/edit)

### Files likely to change
- Floor layout only (plus Task 2 module helper)

### Database changes
None.

### Permission changes
None.

### UI changes
None.

### Test cases
- Member without audits.view → `/floor/audits` → `/dashboard`
- Audits module off → same
- Auditor → floor loads; scan without `audits.edit` still fails at action (KEEP)

### Acceptance criteria
- [ ] Floor layout performs both checks
- [ ] Desk `/dashboard/administration/audits` uses the same module+view rule

### Rollback
Revert layout.

---

## Task 5 — Vendor shell (TAGX-006)

### Objective
Vendor-scoped users do not get a staff information architecture. Do not create `/vendor` routes.

### Current problem
Sidebar always shows Dashboard and Assets. Vendor role can open those URLs; RLS limits asset rows but the chrome is staff-like. Catalogs are usually permission-hidden already.

### Expected result
If `users.vendor_id` is set:

- Sidebar: Maintenance (tickets) + assigned-assets list only (or Assets labeled for assigned kit). No Administration, Vendors, Settings, Reports, Floor, Audits unless the role actually has those permissions (Vendor seed does not).
- `/dashboard` shows ticket-oriented tiles or redirects to maintenance.
- Task 3 GET gates remain the real control.

### Files to inspect
- `src/components/layout/app-sidebar.tsx`
- `src/app/(dashboard)/layout.tsx`
- `src/modules/users/queries.ts` (`getUserWithRole` / `CurrentUser`)
- `src/lib/permissions/admin-sections.ts`
- Vendor role seed in `0038_vendors_pm.sql` (KEEP; do not resplit roles)

### Files likely to change
- `CurrentUser` to include `vendorId`
- `app-sidebar.tsx`
- Maybe dashboard page redirect

### Database changes
None.

### Permission changes
None. Do not grant vendors extra modules.

### UI changes
Reduced sidebar. Do not restyle the whole product.

### Test cases
- Vendor invite accept → `vendor_id` set → no Settings/Roles links
- Direct `/dashboard/administration/settings` denied (Task 3)
- Staff user unchanged
- Vendor can open a ticket-assigned asset detail (RLS KEEP)

### Acceptance criteria
- [ ] `vendorId` available to the shell without a client-supplied company id
- [ ] Default Vendor role sees no staff admin chrome
- [ ] No new route group

### Rollback
Revert sidebar/user type; RLS still applies.

---

## Task 6 — Login rate limiting (TAGX-007)

### Objective
Slow password guessing on tenant and admin login.

### Current problem
`consumeRateLimit` is unused in `signIn` / `signInSuperAdmin`.

### Expected result
e.g. 10 attempts per 15 minutes per `ip+email+slug` (tenant) and `ip+email` (admin). Same generic error as invalid password. Comment that multi-instance needs Redis (TAGX-019, not this sprint).

### Files to inspect
- `src/lib/rate-limit.ts`
- `src/modules/users/actions.ts`
- Login forms (no change if errors stay generic)

### Files likely to change
- `src/modules/users/actions.ts`

### Database changes
None.

### Permission changes
None.

### UI changes
None (generic error). Do not reveal “too many attempts” as a user-enumeration oracle if it distinguishes emails — prefer the same copy, or a single “Try again later” for both unknown and throttled. Recommendation: distinct “Try again later” is acceptable; do not say whether the email exists.

### Test cases
- 10 failures then 11th blocked
- Success resets or independent of window (document choice)
- Signup limiter still works

### Acceptance criteria
- [ ] Both login actions call `consumeRateLimit`
- [ ] No Redis required to merge this sprint

### Rollback
Remove the two calls.

---

## Task 7 — Cron order and env example (TAGX-008)

### Objective
Due emails can see tickets created in the same run. Operators know how to set `CRON_SECRET`. Secrets are not in the example file.

### Current problem
`Promise.all` races schedulers. `.env.example` omits `CRON_SECRET` and currently holds live-looking credentials.

### Expected result
```ts
const tickets = await generateDuePlanTickets();
const storage = await sendPendingStorageWarningEmails();
const reminders = await runScheduledReminders();
```
`.env.example` uses empty placeholders and includes `CRON_SECRET=`.

### Files to inspect
- `src/app/api/cron/notifications/route.ts`
- `.env.example`
- `src/modules/maintenance/scheduler.ts`
- `src/modules/email/scheduler.ts`

### Files likely to change
- Cron route
- `.env.example`

### Database changes
None.

### Permission changes
None.

### UI changes
None.

### Test cases
- Read cron route: tickets awaited before reminders
- Example file has no real API keys
- Missing `CRON_SECRET` still 401 (KEEP)

### Acceptance criteria
- [ ] Sequential awaits
- [ ] `CRON_SECRET` documented
- [ ] Example env is placeholders only

### Rollback
Restore `Promise.all` if sequential cron times out (then split jobs — out of sprint).

---

## Order of work inside the sprint

1. Task 7 (smallest, unblocks ops) + Task 1 (auth correctness)
2. Shared `assertPermission` / `assertModule`
3. Task 2 + Task 9 policy
4. Task 3 + Task 4
5. Task 5 vendor shell
6. Task 6 login limiter
7. Regression: signup, invite accept, asset CRUD, audit scan, vendor ticket, public tag, `/admin`

---

## Sprint-wide tests

- Tenant A cannot see tenant B (RLS KEEP)
- Public `/tag/[id]` still anonymous
- Razorpay webhook and cron still bypass session middleware
- CSV export still requires `reports.export` (untouched)
- Asset create still quota-gated (untouched)

## Sprint-wide rollback

Single revert of the sprint branch. No migrations to undo.

## Explicitly not in this sprint

- `.xlsx`, required documents, `vendor_id` form bind, email retry, audit photos, invite hashing, media session, company suspension column
- Search, archive, departments, workflows, PDF, SSO

Those remain planned in `TAGX_REMAINING_DEVELOPMENT_PLAN.md` Phase 1 sprint 1b and later phases.
