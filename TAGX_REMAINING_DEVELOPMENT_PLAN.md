# TagX Remaining Development Plan

Planning only. No code, schema, or product rebuild. Starting point: `TAGX_IMPLEMENTED_FEATURES.md`, `TAGX_DATABASE_FEATURE_MAP.md`, `TAGX_ROUTE_INVENTORY.md`, `TAGX_IMPLEMENTATION_REVIEW_SUMMARY.md`. Critical items were re-checked against source on 17 Sep 2026.

## Classification legend

| Label | Meaning |
| --- | --- |
| KEEP | Works end-to-end. Do not rebuild. Leave off the immediate backlog unless a verified issue appears. |
| FIX | Existing behavior is wrong. |
| COMPLETE | Feature exists; missing pieces must be finished. |
| HARDEN | Works, but needs security, validation, or production strength. |
| IMPROVE | Works; usability or capability upgrade later. |
| NEW | Not present in the codebase. |
| DEFER | Valuable, not next. |

## Verified facts used by this plan

- `signIn` selects `company_id` only; `users.is_active` is not read (`src/modules/users/actions.ts`).
- `getRolesForAdministration`, `getCompanyUsersForAdmin`, `getStatusesForAdmin`, `getConditionsForAdmin`, `getCategoriesForAdmin`, `getMaintenanceTicketsForAdmin`, `getAssetsForList`, `getAssetDetail`, `getWorkspaceSettingsForAdmin` do not call `requirePermission`.
- Users/roles layout hides tabs but still renders `children` (no redirect).
- `createAuditAction` / `recordAuditScanAction` check RBAC, not `requireModule("audits")`.
- Floor layout checks session only.
- Sidebar always links Dashboard and Assets; Vendor role has `assets.view` + `maintenance.view/edit`.
- Asset form `vendor` is a text field; `assets.vendor_id` is unused in the form/schema.
- Export `xlsx` returns SpreadsheetML with a `.xls` name (`exportReportAction`).
- `recordAuditScanAction` enforces remarks, not photos.
- Email dispatch inserts `notification_logs` then updates to `failed`; a later insert of the same occurrence is blocked by the unique key.
- Cron uses `Promise.all` for PM tickets and reminder emails.
- `.env.example` has no `CRON_SECRET` and currently contains live-looking secrets (must be sanitized).
- `/api/media` has no session check.
- Invite tokens are 32-byte hex stored in `company_invites.token`.
- `isModuleEnabled` returns true for super admins.
- No `companies.suspended` column. Subscription `status` exists but is not checked at login.

Do not rebuild KEEP items. Do not add a second asset, audit, vendor, or email module.

---

## Section A – Completed features to preserve

These are KEEP. Optional enhancements are not Phase 1 work.

### Organization signup and tenant login

- Route/file: `/signup`, `/{slug}/login`, `src/modules/billing/actions.ts`, `src/modules/users/actions.ts`
- Tables: `companies`, `users`, `roles`, `company_subscriptions`
- Why complete: Self-serve company create, slug login, company membership check, post-login redirect
- Optional later: 2FA, SSO (Phase 7)

### Tenant isolation

- Route/file: `src/middleware.ts`, RLS helpers in `0002_platform_admins_and_helpers.sql`
- Tables: all tenant tables with `company_id`
- Why complete: Session-derived `current_company_id()`, no client-supplied tenant id
- Optional later: impersonation with audit (DEFER)

### White-label branding

- Route/file: `/dashboard/administration/settings`, `src/lib/color.ts`, login/tag/floor shells
- Tables: `companies.logo_url`, `primary_color`, `secondary_color`
- Why complete: Logo and colors apply across tenant UI
- Optional later: custom domain, email from-name per tenant

### Plans and Razorpay code

- Route/file: `/admin/plans`, `/admin/orders`, `/api/razorpay/webhook`, `src/lib/razorpay.ts`
- Tables: `billing_plans`, `company_subscriptions`, `billing_orders`, `razorpay_webhook_events`
- Why complete: Plans, quota, extras, signature-checked webhook
- Optional later: invoices/GST (Phase 5)

### Team invitations

- Route/file: `/dashboard/administration/users`, `/invite/[token]`
- Tables: `company_invites`
- Why complete: Email + token + expiry + accept + optional vendor bind
- Related: token hashing is HARDEN (Section B), not a rebuild

### Custom roles and permissions

- Route/file: `/dashboard/administration/roles`, `src/lib/permissions/taxonomy.ts`
- Tables: `roles.permissions`
- Why complete: Matrix editor, create/delete custom roles, Admin seed
- Related: GET protection and custom-role backfill are COMPLETE/HARDEN, not a rebuild

### Asset CRUD

- Route/file: `/assets`, `/assets/new`, `/assets/[id]`, `src/modules/assets/actions.ts`
- Tables: `assets`
- Why complete: Create, view, edit, hard delete, quota gate
- Optional later: archive (COMPLETE, Phase 2)

### Asset codes

- Route/file: workspace settings, `increment_asset_sequence`
- Tables: `company_settings.asset_code_format`, `next_asset_sequence`
- Why complete: Atomic sequence, category prefix
- Optional later: none required

### Categories, statuses, conditions, custom fields

- Route/file: `/dashboard/administration/categories|statuses|conditions|fields`
- Tables: `asset_categories`, `asset_statuses`, `asset_conditions`, `category_fields`
- Why complete: CRUD catalogs plus per-category fields
- Related: required-document enforcement is COMPLETE (Section C)

### Location hierarchy

- Route/file: `/dashboard/administration/locations`
- Tables: `locations` (`kind`, parent)
- Why complete: Site → building → floor → room
- Optional later: separate zone entity (DEFER)

### Location history

- Route/file: asset detail, `recordAssetLocationMove`
- Tables: `asset_location_history`
- Why complete: Moves recorded on create/update
- Optional later: location-centric history page (IMPROVE)

### Handover, transfer, return, and dispose

- Route/file: asset custody panel, `src/modules/custody/actions.ts`
- Tables: `asset_handovers`, `asset_transfers`, `asset_returns`, `assets.allotted_to`
- Why complete: Structured flows, emails, lifecycle events
- Related: expected return / overdue are COMPLETE (Phase 2)

### Asset timeline

- Route/file: asset detail
- Tables: `asset_lifecycle_events`
- Why complete: Custody events listed
- Related: `audit_log` on asset CRUD is HARDEN

### QR generation and public QR pages

- Route/file: `src/components/assets/qr-tag.tsx`, `/tag/[id]`
- Tables: `assets.qr_generated_at`
- Why complete: SVG generate/download, public identification, issue report
- Related: print/bulk/security are IMPROVE/COMPLETE (Phase 2–3)

### Maintenance tickets

- Route/file: `/dashboard/administration/maintenance`
- Tables: `maintenance_tickets`
- Why complete: Create, assign, vendor, priority, due, status updates, public QR report
- Related: comments/attachments/costs are COMPLETE (Phase 4)

### Preventive maintenance

- Route/file: `/dashboard/administration/maintenance/plans`, `src/modules/maintenance/scheduler.ts`
- Tables: `maintenance_plans`
- Why complete: Plans create tickets on cron
- Related: plan edit/delete COMPLETE (Phase 4); cron order FIX (Phase 1)

### Audit campaigns

- Route/file: `/dashboard/administration/audits`
- Tables: `audits`, `audit_items`
- Why complete: Create (location or all), start, complete, delete, exceptions, export
- Related: module gate, photos, scopes (COMPLETE/FIX)

### Floor scan mode

- Route/file: `/floor/audits`, `/floor/audits/[id]`, camera scanner
- Tables: `audit_items`
- Why complete: Walk-mode scan UI exists
- Related: layout permission HARDEN (Phase 1)

### Vendor records and vendor RLS

- Route/file: `/dashboard/administration/vendors`, `0038_vendors_pm.sql`
- Tables: `vendors`, `users.vendor_id`, `assets.vendor_id`, `maintenance_tickets.vendor_id`
- Why complete: CRUD (no delete), Vendor role, RLS on assets/tickets
- Related: nav/form FK COMPLETE/HARDEN (Phase 1)

### Asset documents and expiry rules

- Route/file: attachment uploader, `0041_document_expiry_rules.sql`
- Tables: `asset_documents`, `document_types`, `notification_rules`
- Why complete: Upload, type, expiry, reminder rules
- Related: enforcement and signed URLs COMPLETE/HARDEN

### Dashboard

- Route/file: `/dashboard`
- Tables: aggregate RPCs
- Why complete: Tiles and charts
- Optional later: role-specific dashboards (NEW, Phase 6)

### CSV reports

- Route/file: `/dashboard/administration/reports`, `REPORT_KEYS`
- Tables: read-only queries
- Why complete: CSV path + `reports.export`
- Related: real xlsx FIX (Phase 1)

### CSV import

- Route/file: reports admin, `import_jobs`
- Tables: `import_jobs`, `assets`
- Why complete: Template, preview, commit, error file, history
- Optional later: mapping UI (IMPROVE), rollback (DEFER)

### Email templates and rules

- Route/file: `/dashboard/administration/notifications`, `src/modules/email/`
- Tables: `email_templates`, `notification_rules`, `notification_logs`
- Why complete: Edit templates, toggle rules, logs, event dispatch
- Related: retry FIX (Phase 1)

### Cron job

- Route/file: `/api/cron/notifications`, `vercel.json`
- Tables: used by schedulers
- Why complete: Bearer auth, fail closed without secret
- Related: sequence + docs FIX/HARDEN (Phase 1)

### Super-admin functionality

- Route/file: `/admin/**`
- Tables: `platform_admins`, companies, billing, `crm_leads`
- Why complete: Companies, plans, orders, leads, storage, delete company
- Related: module-bypass policy HARDEN; impersonation DEFER

### Marketing website and CRM

- Route/file: `/`, `/demo`, `/inquire`, `/admin/leads`
- Tables: `crm_leads`
- Why complete: Public site + lead inbox
- Optional later: none required for production

---

## Section B – Production blockers and critical fixes

Immediate backlog. KEEP features are not listed here except where they have a verified issue.

### TAGX-001 Block deactivated users

- Type: FIX | Priority: P0 | Phase: 1 | Complexity: Small
- Impact: Off-boarding does not revoke access.
- Current: `toggleUserActiveAction` sets `users.is_active`; `signIn` ignores it. Existing sessions also continue.
- Expected: Inactive users cannot start a session. Middleware signs out inactive users.
- Files: `src/modules/users/actions.ts`, `src/modules/users/queries.ts`, `src/middleware.ts`, user list UI
- Database: none (`is_active` exists)
- Solution: Select `is_active` after password success; sign out and return a generic auth error. Middleware: if profile `is_active = false`, sign out and redirect to login.
- Tests: deactivate then password login fails; already-open session is dropped on next navigation; wrong-company still generic; super-admin login unchanged
- Dependencies: none

### TAGX-002 Enforce module access on reads and writes

- Type: HARDEN | Priority: P0 | Phase: 1 | Complexity: Medium
- Impact: Disabled modules remain usable via URL.
- Current: Nav hides features. Audit mutations skip `requireModule`. Several pages render with empty data.
- Expected: Disabled module → redirect (pages) and error/`[]` (actions). Super-admin on `/admin` unchanged; tenant UI honors the company’s flags.
- Files: `src/lib/permissions/features.ts`, `src/lib/permissions/admin-sections.ts`, `src/modules/audits/actions.ts`, maintenance/vendors/reports/custody actions, dashboard/floor/admin pages
- Database: none
- Solution: Shared `assertModule(module)` used by pages (`redirect`) and actions. Add `requireModule("audits")` to every audit action. Stop treating super admins as “all modules on” inside tenant routes.
- Tests: disable audits → `/dashboard/administration/audits` and `/floor/audits` redirect; create/scan fail; other modules unchanged
- Dependencies: TAGX-003 page deny helper

### TAGX-003 Protect admin GET actions and direct URLs

- Type: HARDEN | Priority: P0 | Phase: 1 | Complexity: Medium
- Impact: Hidden nav is not authorization. Role matrix and catalogs leak to any tenant session.
- Current: Verified unguarded GETs include roles, users, invites, statuses, conditions, categories, maintenance tickets, assets list/detail, workspace settings. Users/roles layout does not redirect.
- Expected: Missing `view` (or create for new-asset) → empty/`notFound`/redirect. Mutations already mostly gated — keep them.
- Files: listed `get*` functions under `src/modules/*/actions.ts`; admin `page.tsx` files; `src/app/(dashboard)/assets/page.tsx` and `[id]/page.tsx`; users-and-roles layout
- Database: none
- Solution: `requirePermission` on every tenant GET that is not public. Page helper: if `!view` then `redirect("/dashboard")` or `notFound()`.
- Tests: member without `roles.view` hitting `/dashboard/administration/roles` is denied; without `assets.view` `/assets` denied; with permission still works
- Dependencies: none

### TAGX-004 Protect the roles page

- Type: HARDEN | Priority: P0 | Phase: 1 | Complexity: Small
- Impact: Permission map is visible without `roles.view`.
- Current: `getRolesForAdministration` returns `listRoles()` with no check.
- Expected: Requires `roles.view`.
- Files: `src/modules/roles/actions.ts`, roles `page.tsx`, users-and-roles layout
- Database: none
- Solution: Gate GET; redirect in layout if the requested tab is not permitted (do not render children).
- Tests: as TAGX-003 focused on roles
- Dependencies: TAGX-003

### TAGX-005 Floor layout requires audits permission and module

- Type: HARDEN | Priority: P0 | Phase: 1 | Complexity: Small
- Impact: Any signed-in user can open `/floor/**`.
- Current: Layout only checks session.
- Expected: `audits` module on + `audits.view` (scan still needs `audits.edit` in actions).
- Files: `src/app/(floor)/floor/layout.tsx`
- Database: none
- Solution: Redirect to `/dashboard` when checks fail.
- Tests: user without audits.view cannot load floor; auditor can
- Dependencies: TAGX-002

### TAGX-006 Vendor staff navigation and extra data

- Type: HARDEN | Priority: P0 | Phase: 1 | Complexity: Medium
- Impact: Vendors land in a staff shell (Dashboard + Assets). Other tenant tables are not vendor-filtered (locations, vendors list, settings) if they guess URLs.
- Current: Vendor RLS on `assets` and `maintenance_tickets` is real. Sidebar always shows Dashboard/Assets. Catalogs require extra permissions (usually absent on Vendor role).
- Expected: Vendor shell: tickets (and assigned assets) only. Direct catalog/settings URLs denied. Do not build a second portal app (KEEP same origin).
- Files: `src/components/layout/app-sidebar.tsx`, dashboard layout, TAGX-003 gates, optional `getCurrentUser` vendorId
- Database: none (read `users.vendor_id`)
- Solution: If `vendor_id` set, render a reduced sidebar; dashboard becomes ticket counts or redirect to maintenance. Combine with GET gates.
- Tests: vendor cannot open roles/settings/vendors admin; sees only RLS-scoped assets; staff unchanged
- Dependencies: TAGX-003

### TAGX-007 Login rate limiting

- Type: HARDEN | Priority: P0 | Phase: 1 | Complexity: Small (in-process) / Medium (shared store)
- Impact: Password spraying is unbounded.
- Current: `consumeRateLimit` exists; login does not use it. Store is process-local.
- Expected: Per IP + email + slug limit (e.g. 10 / 15 min). Generic error. Document that multi-instance needs Redis.
- Files: `src/modules/users/actions.ts`, `src/lib/rate-limit.ts`
- Database: none for v1
- Solution: Call existing limiter in `signIn` and `signInSuperAdmin`. Phase 1b: Upstash/Redis if more than one instance.
- Tests: 11th attempt blocked; success after window; tenant vs admin buckets separate
- Dependencies: none

### TAGX-008 Cron sequencing and CRON_SECRET documentation

- Type: FIX + HARDEN | Priority: P0 | Phase: 1 | Complexity: Small
- Impact: Same-run PM tickets can miss due emails. Operators cannot configure cron.
- Current: `Promise.all([generateDuePlanTickets, sendPendingStorageWarningEmails, runScheduledReminders])`. `.env.example` omits `CRON_SECRET` and contains live-looking secrets.
- Expected: Tickets first, then reminders. Example env lists `CRON_SECRET=` with placeholders only (no real keys).
- Files: `src/app/api/cron/notifications/route.ts`, `.env.example`
- Database: none
- Solution: `await generateDuePlanTickets()` then the email jobs. Sanitize `.env.example`.
- Tests: unit/order comment + manual cron; example file has no live credentials
- Dependencies: none

### TAGX-009 Super-admin module flag policy

- Type: HARDEN | Priority: P1 | Phase: 1 | Complexity: Small
- Impact: Platform operators browsing a tenant workspace see disabled modules as on.
- Current: `isModuleEnabled` short-circuits for super admins.
- Expected: `/admin` unrestricted. Tenant routes use the company’s `enabled_modules`. Super admin still bypasses RBAC unless we later add impersonation.
- Files: `src/lib/permissions/features.ts`
- Database: none
- Solution: Remove super-admin true-bypass in `isModuleEnabled`. Keep `requirePermission` super-admin bypass.
- Tests: super admin in tenant with audits off cannot open audit pages; `/admin` still works
- Dependencies: TAGX-002

### TAGX-010 Subscription and organization access at login

- Type: COMPLETE + NEW (suspension column) | Priority: P1 | Phase: 1 | Complexity: Medium
- Impact: Halted/canceled subscribers still use the app. No platform suspend switch.
- Current: Quota blocks asset create only. No `companies` suspension field.
- Expected: `past_due` / `halted` / `canceled` / `pending_payment` → billing wall (read-only or login message — pick one and apply consistently). Super admin can set `suspended_at` and block tenant login.
- Files: `signIn`, middleware, billing queries, admin company dialog
- Database: `companies.suspended_at timestamptz null` (new). Reuse `company_subscriptions.status`
- Solution: After membership check, load subscription + company. Suspended → sign out. Non-active subscription → redirect `/dashboard/administration/settings` with banner, block mutating actions except billing.
- Tests: canceled cannot create assets or open register (per chosen policy); super admin can suspend; assigned complimentary `active` plan still works
- Dependencies: product choice: hard login block vs read-only. Recommendation: suspend = login block; canceled/halted = login allowed, mutations blocked except billing/settings.

### TAGX-011 Media access protection

- Type: HARDEN | Priority: P1 | Phase: 1 | Complexity: Medium
- Impact: Anyone with an object key can fetch the file. Cache is public 1 hour.
- Current: `GET /api/media/[...key]` → R2 if key matches `companies/{id}/...`
- Expected: Logos and public tag images remain fetchable (unguessable keys). Attachments (invoices, etc.) require a same-company session (or short-lived signed URL).
- Files: `src/app/api/media/[...key]/route.ts`, `src/modules/storage/actions.ts`, `src/lib/media-url.ts`, attachment UI
- Database: none required for session-gated path
- Solution (Phase 1): classify keys (`.../logo`, `.../assets/{id}/image` vs `.../attachments`). Attachments: `getRequestAuthUser` + `current_company_id()` matches key company. Private responses `Cache-Control: private, no-store`. Signed URLs DEFER to COMPLETE if session gating is not enough.
- Tests: anonymous can load logo; anonymous cannot load attachment key; other tenant session 404
- Dependencies: none

### TAGX-012 Invite token hashing

- Type: HARDEN | Priority: P1 | Phase: 1 | Complexity: Medium
- Impact: DB leak of `company_invites` yields live invite URLs.
- Current: `randomBytes(32).toString("hex")` stored in `token`.
- Expected: Store `token_hash` (SHA-256). URL still carries raw token. Lookup hashes the path token. Existing rows migrated or expired.
- Files: `src/modules/companies/mutations.ts`, `src/modules/users/queries.ts`
- Database: add `token_hash`, stop selecting raw token; expire old plaintext rows
- Solution: Hash at insert; unique on hash; accept page hashes input
- Tests: new invite accepts; raw DB value is not the URL token; expired plaintext invites fail
- Dependencies: migration 0042 (planned, not created)

### TAGX-013 Real `.xlsx` export

- Type: FIX | Priority: P1 | Phase: 1 | Complexity: Medium
- Impact: “Excel” files are XML `.xls`.
- Current: `tableToExcelXml`, filename `.xls`, mime `application/vnd.ms-excel`. No SheetJS/ExcelJS in `package.json`.
- Expected: `.xlsx` Office Open XML; keep CSV. `reports.export` already required — KEEP.
- Files: `src/modules/reports/actions.ts`, `reports-admin.tsx`
- Database: none
- Solution: Add `exceljs` (or equivalent). Build a workbook from `ReportTable`. Do not replace CSV.
- Tests: Excel opens the file; CSV unchanged; export permission still required
- Dependencies: new npm dependency

### TAGX-014 Enforce category required documents

- Type: COMPLETE | Priority: P1 | Phase: 1 | Complexity: Medium
- Impact: Category checkboxes do not affect assets.
- Current: `category_required_documents` written from category form; never read on asset create/upload.
- Expected: Warn on asset detail if missing types; block complete/dispose or allow save with warning — recommendation: block dispose and show a checklist on detail; upload still allowed. Do not invent a workflow engine.
- Files: `src/modules/assets/actions.ts`, asset detail page, `src/modules/categories/queries.ts`
- Database: none (tables exist)
- Solution: Compare `asset_documents.document_type` vs required keys. Surface missing list. Optional hard block on `disposeAssetAction`.
- Tests: category requires invoice → detail shows missing; after upload, clear; dispose blocked until present
- Dependencies: none

### TAGX-015 Connect purchase vendor to `assets.vendor_id`

- Type: COMPLETE | Priority: P1 | Phase: 1 | Complexity: Small
- Impact: Vendor RLS never sees purchase-linked assets; text vendor is a free string.
- Current: Form `name="vendor"` text; schema `vendor` string; `assets.vendor_id` unused.
- Expected: Select from `vendors` (optional). Persist `vendor_id`. Keep displaying name via join. Deprecate free-text or copy vendor name into `vendor` for old reports.
- Files: `asset-form.tsx`, `src/modules/assets/validation.ts`, `mutations.ts`, `queries.ts`, `getAssetFormOptionsForForm`
- Database: none (column exists)
- Solution: Add vendor options; save `vendorId`; backfill not required
- Tests: select vendor → column set; vendor user sees those assets; clear vendor allowed
- Dependencies: vendors module KEEP

### TAGX-016 Failed email retry

- Type: FIX | Priority: P1 | Phase: 1 | Complexity: Small
- Impact: Transient Brevo errors skip that occurrence forever (insert unique).
- Current: Failed updates the same row; next insert hits unique and `continue`s.
- Expected: Retry failed rows in cron (in-place update). Successful sends still idempotent.
- Files: `src/modules/email/dispatch.ts`, `src/modules/email/scheduler.ts`, cron route
- Database: none if retry updates existing `failed` rows (verified possible)
- Solution: `retryFailedNotificationEmails()` selects `status = 'failed'`, resends, sets `sent` or increments error text. Cap attempts in `error` or add `attempt_count` later if needed.
- Tests: forced fail then cron sends; already `sent` not duplicated
- Dependencies: TAGX-008 order (retry after new sends)

### TAGX-017 Enforce audit exception photos

- Type: FIX | Priority: P1 | Phase: 1 | Complexity: Medium
- Impact: Campaign flag is ignored.
- Current: `require_photo_on_exception` saved; scan has no file field.
- Expected: Same as remarks: if flag on and scan is an exception, require an image (R2), store path on the item.
- Files: `src/modules/audits/actions.ts`, `validation.ts`, scan forms, tag verify form
- Database: `audit_items.exception_photo_path text` (new)
- Solution: Reuse storage allow-list. Enforce in `recordAuditScanAction` and `markMissingAction` when the flag is on.
- Tests: flag off → no photo; flag on + mismatch without photo errors; with photo succeeds
- Dependencies: media rules (TAGX-011)

### TAGX-018 Audit duplicate scan handling

- Type: COMPLETE | Priority: P1 | Phase: 1 (light) / 3 (policy UI)
- Impact: Second scan silently overwrites the item (`unique (audit_id, asset_id)`).
- Current: Exception type `duplicate` exists but is not set.
- Expected Phase 1: If item already `verified`/`exception`, reject unless `force=true` (supervisor). Do not insert a second row.
- Files: `src/modules/audits/mutations.ts`, `recordAuditScanAction`, floor form
- Database: none
- Solution: Read current item status; return “already recorded”; optional override with `audits.edit`
- Tests: second scan rejected; override updates
- Dependencies: none

---

P2/P3 from the known list (not sprint 1):

| ID | Item | Type | Priority | Notes |
| --- | --- | --- | --- | --- |
| TAGX-019 | Shared rate-limit store | HARDEN | P2 | After login limiter exists |
| TAGX-020 | Custom role permission backfill | COMPLETE | P2 | Older roles lack vendors/handover/reports/assign/export |
| TAGX-021 | `writeAuditLog` on asset CRUD | HARDEN | P2 | Table exists |
| TAGX-022 | Vendor cannot read full vendor master | HARDEN | P3 | RLS on `vendors` is tenant-wide |

---

## Section C – Existing features that need completion

Not NEW. Do not create parallel modules.

### Module access — COMPLETE / HARDEN (Phase 1)

Enforce on pages, server actions, and cron is already secret-gated. There is no tenant module API beyond cron/media/razorpay. Direct URLs and reads: TAGX-002, TAGX-003, TAGX-005.

### User and role management

| Item | Type | Phase | Notes |
| --- | --- | --- | --- |
| Deactivated login | FIX | 1 | TAGX-001 |
| Protect roles/users GET | HARDEN | 1 | TAGX-003/004 |
| Custom role backfill | COMPLETE | 1 or 2 | Merge missing keys into existing jsonb without wiping custom maps |
| User deletion | DEFER | 2+ | Prefer deactivate (KEEP) until offboarding workflow exists |
| Login activity | NEW | 2 | New table; not required for production if rate limit ships |

### Asset management

| Item | Type | Phase | Notes |
| --- | --- | --- | --- |
| Archive | COMPLETE | 2 | Use `is_final` statuses or `archived_at`; do not remove hard delete immediately |
| Search | COMPLETE | 2 | `ilike` name/code/serial on existing list |
| Subcategories | NEW | 2 | Needs `parent_id` — only if product still wants hierarchy; else DEFER |
| Tags | NEW | 2 | New tables |
| Departments | NEW | 2 | New tables; locations are not departments |
| Bulk actions | COMPLETE | 2 | Multi-select on `/assets`; reuse mutations |
| Vendor ID | COMPLETE | 1 | TAGX-015 |
| Asset `audit_log` | HARDEN | 1–2 | TAGX-021 |

### QR and barcode

| Item | Type | Phase | Notes |
| --- | --- | --- | --- |
| Print | IMPROVE | 2 | Print CSS / window.print on existing SVG |
| Replacement | COMPLETE | 2 | Regenerating today does not invalidate old stickers (same UUID URL) |
| QR security | HARDEN | 3 / DEFER | Signed/expiring tags need new token column |
| Bulk print | COMPLETE | 2 | Multi-select + print sheet |
| Barcode symbology | NEW | DEFER | Camera detector is not Code128 labeling |
| NFC/RFID | DEFER | 7 | No columns |

### Custody

| Item | Type | Phase | Notes |
| --- | --- | --- | --- |
| Expected return date | COMPLETE | 2 | Column on `asset_handovers` |
| Overdue tracking | COMPLETE | 2 | Query + dashboard tile |
| Return reminders | COMPLETE | 2 | Reuse email engine (`notification_rules`) |
| Receipts | IMPROVE | 2 | Print/PDF of existing handover row |
| Accessories | IMPROVE then NEW | 2 / 4 | Keep text; structured lines later |

### Maintenance

| Item | Type | Phase | Notes |
| --- | --- | --- | --- |
| Comments | COMPLETE | 4 | New `maintenance_ticket_comments` |
| Attachments | COMPLETE | 4 | Reuse R2 pattern |
| Costs | COMPLETE | 4 | Columns on tickets |
| Delete vs cancel | KEEP cancel; COMPLETE policy | 4 | Do not add delete unless required; `cancelled` exists |
| Plan edit/delete | COMPLETE | 4 | Actions missing |
| SLA / escalation | NEW | 4 | Only if Phase 4 approved |

### Audits

| Item | Type | Phase | Notes |
| --- | --- | --- | --- |
| Mandatory photos | FIX | 1 | TAGX-017 |
| Duplicate protection | COMPLETE | 1 | TAGX-018 |
| Wrong-custodian detect | COMPLETE | 3 | Compare `allotted_to` on scan |
| Assignment | NEW | 3 | No assignee column |
| Approval | NEW | 3 | Complete is single-step today |
| Exception catalog UI | IMPROVE | 3 | DB catalog unused |

### Documents

| Item | Type | Phase | Notes |
| --- | --- | --- | --- |
| Required docs | COMPLETE | 1 | TAGX-014 |
| Issue date | COMPLETE | 2 | Column |
| Access controls | HARDEN | 1 | TAGX-011 |
| Signed URLs | HARDEN | 1b / DEFER | After session gating |
| Validation | KEEP | — | MIME/size already server-side |

### Reports and imports

| Item | Type | Phase | Notes |
| --- | --- | --- | --- |
| Real xlsx | FIX | 1 | TAGX-013 |
| CSV import UX | IMPROVE | 2 | Column mapping optional |
| Excel import | DEFER | 6 | CSV is enough |
| Import rollback | DEFER | 6 | High risk; keep error file |
| Export permission | KEEP | — | `reports.export` already on export action |
| Large export limits | HARDEN | 6 | Cap rows; do not invent a job system in Phase 1 |

---

## Section D – New features to develop

Only items that are genuinely missing. Each is default **configurable per organization** via existing `enabled_modules` or a new flag — do not add a generic workflow OS.

Complexity: S < ~3 days, M ~1–2 weeks, L multi-week.

### Asset operations

#### Employee offboarding

- Type: NEW | Priority: P1 | Phase: 2 | Complexity: M | Configurable: yes (handover module)
- Problem: Leaving staff still hold assets; deactivate alone is insufficient
- Roles: Admin, manager, custodian
- Workflow: Pick user → list allotted assets → force return or transfer → then deactivate (TAGX-001)
- Pages: `/dashboard/administration/users/[id]/offboard`
- Tables: reuse custody tables; no workflow engine
- Permissions: `users.edit` + `handover.assign`
- Notifications: `asset_returned` / `asset_transferred` (KEEP templates)
- Reports: unassigned/missing already exist
- Dependencies: TAGX-001, custody KEEP

#### Accessory management

- Type: NEW | Priority: P2 | Phase: 2 (light) / 4 (master) | Complexity: M
- Problem: Accessories are free text on handover
- Roles: Admin, custodian
- Workflow: Optional child assets or line items on handover
- Pages: extend asset detail
- Tables: `asset_accessories` or reuse `linked_asset_id`
- Permissions: `assets.edit`, `handover.assign`
- Notifications: none at first
- Reports: none at first
- Dependencies: custody KEEP
- Recommendation: Phase 2 IMPROVE text + checklist; master data DEFER if timeboxed

#### Asset request / approval / procurement / receiving / replacement / disposal approval / depreciation

- Type: NEW | Priority: P2–P3 | Phase: 5 | Complexity: L each
- Problem: Finance and purchase control
- Roles: Employee, manager, finance, admin
- Workflow: request → approve → PO → receive → asset create (reuse KEEP create)
- Pages: `/dashboard/requests/**` (new, not a second asset register)
- Tables: `asset_requests`, `request_approvals` — only when Phase 5 starts
- Permissions: new module `requests` in taxonomy (extend, do not fork roles)
- Notifications: new event keys in existing email engine
- Reports: request aging
- Dependencies: KEEP assets; KEEP email; no generic form builder
- Configurable: yes (`enabled_modules.requests`)
- Depreciation: columns existed historically and were dropped in 0017 — treat as NEW if reintroduced

### Audit and compliance

#### Audit assignment

- Type: NEW | Priority: P1 | Phase: 3 | Complexity: S–M
- Problem: Anyone with `audits.edit` can scan
- Workflow: campaign `assigned_to` user or role
- Pages: audit create/detail
- Tables: `audits.assigned_to` (new column)
- Permissions: `audits.assign` already in taxonomy — wire it
- Notifications: new `audit_assigned` template
- Dependencies: KEEP audits
- Configurable: yes

#### Advanced audit scopes

- Type: NEW | Priority: P1 | Phase: 3 | Complexity: M
- Problem: Only location or all assets
- Workflow: filters department/category/custodian/selected IDs at create
- Pages: create audit form
- Tables: `audit_scope` jsonb or join tables
- Dependencies: departments NEW if department scope is required; category/custodian/selected can ship without departments
- Configurable: yes

#### Audit approval, comparison, certificates

- Type: NEW | Priority: P2 | Phase: 3 | Complexity: M–L
- Approval: second status after complete
- Comparison: two campaign IDs
- Certificates: PDF (depends on Phase 6 PDF)
- DEFER certificates if PDF not ready

#### Calibration / inspection / compliance dashboard

- Type: NEW | Priority: P3 | Phase: 3–4 | Complexity: L
- Overlap with PM plans and document expiry — extend KEEP modules first; dedicated calibration DEFER unless a customer requires it

### Maintenance

Ticket comments, attachments, costs, plan edit: Section C COMPLETE (Phase 4), not NEW.

SLA, escalation, checklists, spare parts, inventory, analytics: NEW, Phase 4, Complexity L. Configurable. Dependencies: KEEP tickets. Inventory/spares are a new domain — only if approved.

### Vendor and contract management

Vendor documents, contracts, AMC entity, warranty entity, ratings, performance, dedicated portal: NEW, Phase 4, Complexity L.

- Dedicated portal: do **not** add a second Next.js app. Extend vendor shell from TAGX-006.
- AMC/warranty records: asset fields KEEP; vendor-linked contracts are NEW tables
- Configurable: vendors module already exists

### Document management

Versioning, approval, non-asset documents, renewal workflow, compliance dashboard: NEW / COMPLETE mix, Phase 3–4.

- Compliance dashboard can be COMPLETE using existing expiry emails + required docs (Phase 1–3) before versioning

### Reporting

PDF, scheduled reports, custom builder, advanced dashboards, role-specific dashboards: NEW, Phase 6, Complexity L.

- Do not replace `REPORT_KEYS`
- Scheduled reports reuse cron + email engine
- Configurable: reports module KEEP

### Enterprise

API, webhooks, SSO, 2FA, WhatsApp, SMS, PWA/offline, native app, HRMS/ERP, AI: NEW, Phase 7, DEFER. 2FA may pull earlier if security demands (P2 after login rate limit).

---

## Recommended development phases

### Phase 1 – Production readiness

Only FIX / HARDEN / COMPLETE on existing surfaces. No new product modules.

- TAGX-001 … TAGX-018 as specified
- Sanitize `.env.example`
- Custom role key backfill (TAGX-020) if cheap
- RLS smoke checklist (manual): tenant A cannot read tenant B; vendor cannot update assets; public tag has no financials

Out of Phase 1: departments, tags, workflows, PDF, portal app, SSO.

### Phase 2 – Asset operations completion

- Search, archive, bulk actions
- Expected/overdue returns + reminders (email engine KEEP)
- Print QR + bulk print sheet
- Offboarding
- Departments/tags/subcategories only if still required after search/archive
- Login activity optional

### Phase 3 – Audit and compliance

- Wrong-custodian auto-detect
- Assignment, extra scopes, approval, comparison
- Required-document compliance view
- QR signed tags only if still needed
- Calibration/inspection DEFER unless scoped

### Phase 4 – Maintenance and vendor expansion

- Ticket comments/attachments/costs, plan edit/delete
- SLA/escalation/checklists only if approved
- Vendor documents/contracts/ratings; deepen vendor shell (not a new app)

### Phase 5 – Procurement and finance

- Requests, approvals, procurement, receiving, disposal approval, depreciation, financial reports
- Single new `requests` module, not a form OS

### Phase 6 – Reporting and automation

- PDF, scheduled email reports, custom builder, dashboard customization
- Excel import only if CSV is insufficient

### Phase 7 – Enterprise expansion

- API, webhooks, SSO, 2FA, PWA, offline, native, WhatsApp/SMS, ERP, AI

---

## Prioritization table

| ID | Work Item | Type | Priority | Phase | Complexity | Dependencies | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| TAGX-001 | Block deactivated users | FIX | P0 | Phase 1 | Small | Auth flow | Planned |
| TAGX-002 | Enforce module access on reads/writes | HARDEN | P0 | Phase 1 | Medium | Permission system | Planned |
| TAGX-003 | Protect admin/asset GET actions | HARDEN | P0 | Phase 1 | Medium | Permission system | Planned |
| TAGX-004 | Protect roles page and layout | HARDEN | P0 | Phase 1 | Small | TAGX-003 | Planned |
| TAGX-005 | Floor layout audit gate | HARDEN | P0 | Phase 1 | Small | TAGX-002 | Planned |
| TAGX-006 | Vendor sidebar and URL restrictions | HARDEN | P0 | Phase 1 | Medium | TAGX-003, vendor RLS | Planned |
| TAGX-007 | Login rate limiting | HARDEN | P0 | Phase 1 | Small | `rate-limit.ts` | Planned |
| TAGX-008 | Cron sequence + env example | FIX | P0 | Phase 1 | Small | Cron route | Planned |
| TAGX-009 | Super-admin tenant module policy | HARDEN | P1 | Phase 1 | Small | TAGX-002 | Planned |
| TAGX-010 | Subscription / suspension access | COMPLETE | P1 | Phase 1 | Medium | Billing, companies | Planned |
| TAGX-011 | Media attachment auth | HARDEN | P1 | Phase 1 | Medium | Storage | Planned |
| TAGX-012 | Hash invite tokens | HARDEN | P1 | Phase 1 | Medium | Invites | Planned |
| TAGX-013 | Real `.xlsx` export | FIX | P1 | Phase 1 | Medium | Reports | Planned |
| TAGX-014 | Enforce required documents | COMPLETE | P1 | Phase 1 | Medium | Categories, documents | Planned |
| TAGX-015 | Bind `assets.vendor_id` | COMPLETE | P1 | Phase 1 | Small | Vendors, assets | Planned |
| TAGX-016 | Retry failed emails | FIX | P1 | Phase 1 | Small | Email logs | Planned |
| TAGX-017 | Enforce audit exception photos | FIX | P1 | Phase 1 | Medium | Audits, R2 | Planned |
| TAGX-018 | Reject duplicate audit scans | COMPLETE | P1 | Phase 1 | Small | Audits | Planned |
| TAGX-019 | Shared rate-limit store | HARDEN | P2 | Phase 1b | Medium | TAGX-007 | Planned |
| TAGX-020 | Backfill custom role keys | COMPLETE | P2 | Phase 1 | Small | Roles jsonb | Planned |
| TAGX-021 | Audit-log asset CRUD | HARDEN | P2 | Phase 2 | Small | `audit_log` | Planned |
| TAGX-022 | Asset search | COMPLETE | P1 | Phase 2 | Small | Asset list | Planned |
| TAGX-023 | Asset archive | COMPLETE | P1 | Phase 2 | Medium | Statuses | Planned |
| TAGX-024 | Bulk asset actions | COMPLETE | P1 | Phase 2 | Medium | Asset mutations | Planned |
| TAGX-025 | Expected / overdue returns | COMPLETE | P1 | Phase 2 | Medium | Custody, email | Planned |
| TAGX-026 | QR print and bulk sheet | IMPROVE | P2 | Phase 2 | Medium | QR tag | Planned |
| TAGX-027 | Employee offboarding | NEW | P1 | Phase 2 | Medium | TAGX-001, custody | Planned |
| TAGX-028 | Departments | NEW | P2 | Phase 2 | Medium | Assets, users | Planned |
| TAGX-029 | Tags | NEW | P2 | Phase 2 | Medium | Assets | Planned |
| TAGX-030 | Subcategories | NEW | P2 | Phase 2 | Medium | Categories | Planned |
| TAGX-031 | Login activity | NEW | P2 | Phase 2 | Medium | Auth | Planned |
| TAGX-032 | User hard-delete | DEFER | P3 | Phase 2 | Medium | Offboarding | Deferred |
| TAGX-033 | Wrong-custodian detection | COMPLETE | P1 | Phase 3 | Small | Audit scan | Planned |
| TAGX-034 | Audit assignment | NEW | P1 | Phase 3 | Small | Audits | Planned |
| TAGX-035 | Advanced audit scopes | NEW | P1 | Phase 3 | Medium | Audits, optional departments | Planned |
| TAGX-036 | Audit approval | NEW | P2 | Phase 3 | Medium | Audits | Planned |
| TAGX-037 | Audit comparison | NEW | P2 | Phase 3 | Medium | Audits | Planned |
| TAGX-038 | Signed/expiring QR | HARDEN | P3 | Phase 3 | Large | Public tags | Deferred |
| TAGX-039 | Ticket comments / attachments / costs | COMPLETE | P2 | Phase 4 | Medium | Maintenance | Planned |
| TAGX-040 | PM plan edit/delete | COMPLETE | P2 | Phase 4 | Small | Plans | Planned |
| TAGX-041 | SLA and escalation | NEW | P2 | Phase 4 | Large | Tickets | Deferred unless approved |
| TAGX-042 | Vendor contracts / docs / ratings | NEW | P2 | Phase 4 | Large | Vendors | Planned |
| TAGX-043 | Dedicated vendor portal app | DEFER | P3 | Phase 4 | Large | TAGX-006 | Deferred (extend shell) |
| TAGX-044 | Asset request workflow | NEW | P2 | Phase 5 | Large | Assets | Planned |
| TAGX-045 | Procurement / receiving | NEW | P2 | Phase 5 | Large | TAGX-044 | Planned |
| TAGX-046 | Disposal approval | NEW | P2 | Phase 5 | Medium | Dispose KEEP | Planned |
| TAGX-047 | Depreciation | NEW | P3 | Phase 5 | Medium | Assets | Deferred |
| TAGX-048 | PDF reports | NEW | P2 | Phase 6 | Medium | Reports | Planned |
| TAGX-049 | Scheduled reports | NEW | P2 | Phase 6 | Medium | Cron, email | Planned |
| TAGX-050 | Custom report builder | NEW | P2 | Phase 6 | Large | Report architecture | Planned |
| TAGX-051 | Excel import | DEFER | P3 | Phase 6 | Medium | CSV import KEEP | Deferred |
| TAGX-052 | Import rollback | DEFER | P3 | Phase 6 | Large | Import jobs | Deferred |
| TAGX-053 | Public API / webhooks | NEW | P3 | Phase 7 | Large | Auth | Deferred |
| TAGX-054 | SSO / 2FA | NEW | P2 | Phase 7 | Large | Auth | Deferred |
| TAGX-055 | PWA / offline / native | NEW | P3 | Phase 7 | Large | Floor audit | Deferred |
| TAGX-056 | WhatsApp / SMS / AI / ERP | NEW | P3 | Phase 7 | Large | Email engine | Deferred |
| TAGX-057 | NFC/RFID | DEFER | P3 | Phase 7 | Medium | Assets | Deferred |
| TAGX-058 | Barcode label product | DEFER | P3 | Phase 7 | Medium | QR KEEP | Deferred |

---

## Database migrations required (planned, not created)

Phase 1:

- `companies.suspended_at` (TAGX-010)
- `company_invites.token_hash` + expire plaintext (TAGX-012)
- `audit_items.exception_photo_path` (TAGX-017)

Phase 1 needs **no** migration for: is_active, vendor_id, required documents, email retry, cron order, GET gates, xlsx.

Later phases: departments, tags, subcategory parent, handover expected return, ticket comments, etc. — only when that phase is approved.

## Security priorities (order)

1. Session validity: inactive users, suspension, login throttle
2. Authorization: GET gates, module gates, vendor shell, floor layout
3. Secrets/docs: sanitize `.env.example`, document `CRON_SECRET`
4. Tokens/files: invite hash, attachment media auth
5. Billing access policy
6. Email reliability (retry, cron order)

## Biggest technical risks

- Treating KEEP modules as greenfield and duplicating assets/audits/email
- Building a generic workflow OS for Phase 5 instead of a single requests module
- Signed QR / signed media over-engineering before session checks
- Redis requirement blocking login rate limit (ship in-process first)
- Custom role backfill overwriting tenant-edited maps
- Excel library bundle size
- Vendor UX vs RLS: nav can hide more than RLS allows if GET gates are skipped

## Recommended first sprint

See `TAGX_FIRST_IMPLEMENTATION_SPRINT.md`. Scope is P0 access control plus two small P0 ops fixes (cron order, env example). Remaining Phase 1 items are sprint 1b.
