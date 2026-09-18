# TagX Implementation Review Summary

Code-only audit. No application or schema changes were made. Runtime payment, email delivery, and camera scanning on real devices are marked `NOT_VERIFIED` where they depend on env and hardware.

Checklist size: **306** named items from sections A–P of the audit brief (K has 23 items, not 24).

---

## 1. Executive summary

TagX is a multi-tenant Next.js 14 asset platform with Supabase RLS, Cloudflare R2, Brevo, and Razorpay. The running product already covers: company signup/login and white-label, asset CRUD with catalogs and custom fields, QR public tags, location hierarchy, custody (handover/return/transfer/dispose), maintenance tickets and preventive plans, physical audits including floor scan mode, vendors with scoped users, document attachments with expiry emails, standard CSV reports and asset CSV import, in-app storage alerts, a cron email engine, and a super-admin billing/CRM console.

It is **not** a complete CMMS/EAM suite. There is no workflow/approval engine, no departments, no employee HR master, no vendor portal product, no true `.xlsx`/PDF reporting, no trial/suspension/impersonation, and several security controls are incomplete (login rate limit, deactivated users, public media, plaintext invite tokens, page-level permission gaps).

Overall status: **PARTIALLY_IMPLEMENTED** as a product; core asset + QR + audit + billing paths are **IMPLEMENTED**.

---

## 2. Completed features

Label: `IMPLEMENTED`

These work end-to-end in code (env-dependent services noted):

- Organization signup, slug, tenant login/logout, password reset request flow
- Tenant isolation via `company_id` + RLS + middleware headers
- White-label logo and brand colors on login, shell, floor, and public tag
- Subscription plans, asset quota, extra-asset orders, Razorpay checkout + webhook code
- Team invites with 7-day expiry, custom roles, permission matrix, system Admin role
- Asset create/view/edit/delete, auto asset codes, pagination, category/location/status filters
- Categories, statuses, conditions, custom fields
- Brand, model, serial, description, primary image, purchase/invoice/warranty/AMC/insurance fields
- Location sites/buildings/floors/rooms hierarchy CRUD and descendant filters
- Location history and location report export
- Custodian/employee assignment via `allotted_to` and handover
- Transfer, handover acknowledgement, return record, dispose
- Asset lifecycle timeline
- QR generate/download, public `/tag/[id]`, public issue report, audit QR/manual scan
- Maintenance ticket create, status/assignee update, priority/vendor/due on create
- Preventive plans + cron-generated tickets + maintenance due emails
- Audit campaigns (location or all), start/complete/delete, found/missing/wrong location, remarks, progress, floor UI, exception export
- Vendor create/edit, vendor login via invite, vendor RLS on tickets/assets
- Asset document upload with types and expiry; document expiry email rules
- Main dashboard tiles and bar charts
- Standard reports: register, by status/location/custodian, missing/unassigned, overdue maintenance, warranty/AMC, audit exceptions
- CSV export; CSV asset import with preview, validation, job history
- In-app storage notifications; email templates, rules, logs; assignment/return/transfer emails
- Vercel cron authenticated with `CRON_SECRET` (fail closed if unset)
- Super-admin companies, plans, orders, leads, storage; company delete
- Marketing landing, demo, inquire/CRM leads
- Sensitive fields omitted on public tags

---

## 3. Partially completed features

Label: `PARTIALLY_IMPLEMENTED`

- Organization profile/preferences (no timezone/locale/address)
- Module enable/disable (nav + many mutations; not all pages/reads)
- Email verification (pre-confirm only)
- User profile (no self-service edit)
- User deactivation (flag exists; login ignores it)
- Vendor experience (same app, not a portal; unused `vendors.delete`)
- `audit_log` coverage (custody/vendors/some catalogs/import; not asset CRUD or login)
- Asset type (categories only); multiple images (attachments); linked asset (single FK, not parent tree)
- Accessories as handover text
- Asset vendor text vs `assets.vendor_id` FK
- Asset sort (fixed created_at); no search
- QR print (download only); QR “private” is session-variant of public URL; regenerate does not rotate URL
- Zones as room label; barcode via BarcodeDetector only
- Ticket edit (status/assignee only); technician = any user; maintenance history = ticket list
- Audit scope (location/all only); wrong custodian/damaged/photos/duplicate types incomplete
- Vendor contacts/categories as single fields; AMC/warranty on assets not vendor records
- Media download/preview without signed URLs or in-app PDF viewer
- Category required documents saved, not enforced
- Role-specific dashboards; report filters; Excel as SpreadsheetML `.xls`
- Import mapping/duplicates/bulk export (partial)
- Notification preferences (company admin rules, not per user)
- Return “approval” (single actor)
- Platform user directory, tenant access, feature flags, system logs
- Server-side/module/API/file/document permission layers (see §10–11)
- Rate limiting (some endpoints, in-memory, not login)
- Invite tokens random but plaintext

---

## 4. Defective features

Label: `BUG_FOUND`

These exist and misbehave or contradict their own UI/schema:

- **Deactivated users can still sign in** — `toggleUserActiveAction` writes `users.is_active`; `signIn` never reads it. Impact: off-boarding is ineffective.
- **Excel export is not xlsx** — UI option `xlsx` returns XML `.xls`. Impact: some clients/tools will fail.
- **`require_photo_on_exception` is a no-op** — stored on `audits`, never checked in `recordAuditScanAction`. Impact: auditors can close exceptions without photos.
- **Required documents are not enforced** — category checkboxes persist `category_required_documents` but upload/create does not validate. Impact: compliance UI is cosmetic.
- **Asset purchase vendor is disconnected from vendor module** — form uses `assets.vendor` text; RLS uses `assets.vendor_id`. Impact: vendor users may see no purchase-linked assets.
- **Module disable does not block audit writes** — `createAuditAction` and other audit mutations skip `requireModule("audits")`. Impact: disabled module still writable by URL.
- **Failed emails cannot retry** — unique `(company, event, occurrence, recipient)` plus no retry job. Impact: a transient Brevo failure permanently skips that reminder.
- **PM cron races reminder emails** — `Promise.all` runs `generateDuePlanTickets` and `runScheduledReminders` together. Impact: a ticket created in the same run may miss `maintenance_due` for that day.
- **Direct admin/catalog URLs are not denied** — several GET actions omit `requirePermission`; pages render empty or full data under RLS. Impact: hidden-nav is not security (see §10).
- **`getRolesForAdministration` is unguarded** — any tenant session can load the permission matrix if they hit `/dashboard/administration/roles`. Impact: reconnaissance of RBAC.

---

## 5. Production-readiness issues

Label: `PRODUCTION_HARDENING_REQUIRED`

- `CRON_SECRET` required at runtime but missing from `.env.example`
- In-memory rate limiter does not work across serverless instances
- Login has no rate limit, lockout, or 2FA
- `/api/media` is unauthenticated; keys are capability URLs; 1-hour public cache
- Invite tokens stored and queried in plaintext
- Middleware matcher skips all `/api` routes (cron/webhook/media must auth themselves — they do, except media)
- `writeAuditLog` missing on asset CRUD, ticket updates, audit scans, logins
- Halted/canceled subscriptions do not block login
- No organization suspension flag
- Vendor users still get the staff sidebar (Assets/Dashboard)
- Floor layout does not require `audits` permission
- Super-admin bypasses feature modules (`isModuleEnabled` returns true)
- Horizontal-scale session/rate-limit assumptions
- Document reminder URL may use document id rather than asset id (`NOT_VERIFIED` every template var)
- `.env.example` must be checked for live-looking secrets before any publish
- R2 cleanup on company delete `NOT_VERIFIED`
- pg_cron `check_storage_thresholds` depends on the extension being enabled in the target Supabase project

---

## 6. Missing features

Label: `NOT_IMPLEMENTED`

- Trial logic; organization timezone
- User removal; login activity log
- Archive (vs hard delete / final statuses)
- Subcategories; asset tags; departments
- Asset full-text search; bulk assignment/actions (except CSV import create)
- Bulk QR; NFC/RFID; signed/rotating QR tokens
- Expected return date; overdue return tracking/reminders
- Ticket delete, comments, attachments, costs, SLA, escalation, dedicated reopen
- Audit assignment, department/category/custodian/selected-asset scopes, approval chain, campaign comparison
- Vendor delete, vendor documents, contracts, performance/rating, dedicated portal
- Vendor/employee/contract documents; document issue date, versioning, approval, activity history
- Employee/vendor dashboards as separate products
- Department/vendor/document report keys; PDF export; scheduled reports; custom report builder
- Excel import; location/employee/vendor/category import; import rollback; filtered/large/multi-sheet export
- Audit reminder emails; return-due reminders; approval/escalation notifications; email retry
- Approval workflows for requests, assignment, transfer, maintenance completion, audit closure, vendor onboarding, documents, disposal, purchase, contracts
- Impersonation; platform settings; organization suspension
- Signed file URLs

---

## 7. Database findings

Label mix: `IMPLEMENTED` schema with `PARTIALLY_IMPLEMENTED` usage

- **41 migrations** (0001–0041)
- **~39 live tables** after dropping `permissions` / `role_permissions`
- RLS is present on tenant tables; `audit_log` / `notification_logs` / `notifications` are correctly insert-restricted for `authenticated`
- Vendor RLS on `assets` and `maintenance_tickets` is real
- Weakly used tables: `audit_exception_types`, `maintenance_types` (no editors), `document_types` (no editor), `category_required_documents` (no enforcement)
- Unused/disconnected columns: `users.is_active` (login), `assets.vendor_id` (form), `audits.require_photo_on_exception` (scan), `asset_transfers.acknowledged_*`, `companies.is_dedicated_infra` (runtime)
- No tables for departments, tags, NFC, workflows, ticket comments, contracts, trials, impersonation

Details: `TAGX_DATABASE_FEATURE_MAP.md`

---

## 8. Route findings

Label: `IMPLEMENTED` routes with `PERMISSION ISSUES` on GET

- **42** `page.tsx` files, **3** API routes, plus tenant `/{slug}/login` and `/{slug}/forgot-password`
- Marketing and invite/tag/signup are public by design
- Dashboard layout always exposes Assets and Dashboard
- Admin sections hidden by RBAC + feature flags; **direct URLs often still render**
- `/admin/**` is actually blocked for non-super-admins (middleware + layout) — this path is solid
- `/api/cron/notifications` and `/api/razorpay/webhook` authenticate without middleware
- `/api/media/[...key]` is public

Details: `TAGX_ROUTE_INVENTORY.md`

---

## 9. Security findings

| Item | Label |
| --- | --- |
| RLS + `current_company_id()` | `IMPLEMENTED` |
| Vendor RLS | `IMPLEMENTED` |
| Public tag column subset | `IMPLEMENTED` |
| Cron fail-closed without secret | `IMPLEMENTED` |
| Razorpay signature checks | `IMPLEMENTED` (runtime `NOT_VERIFIED`) |
| Signup/lead/test-email rate limits | `PARTIALLY_IMPLEMENTED` |
| Login protection | `PRODUCTION_HARDENING_REQUIRED` |
| Media access | `PRODUCTION_HARDENING_REQUIRED` |
| Invite tokens at rest | `PRODUCTION_HARDENING_REQUIRED` |
| Signed URLs | `NOT_IMPLEMENTED` |
| Deactivated user login | `BUG_FOUND` |
| Audit log completeness | `PARTIALLY_IMPLEMENTED` |
| Secret management via env | `PARTIALLY_IMPLEMENTED` |

Do not treat this list as a penetration test. No live exploit attempts were run.

---

## 10. Permission findings

| Item | Label |
| --- | --- |
| Taxonomy + role editor | `IMPLEMENTED` |
| Mutating actions generally `requirePermission` | `IMPLEMENTED` |
| Super-admin bypass | `IMPLEMENTED` (also bypasses modules) |
| `assets` list/detail GET | `PERMISSION ISSUES FOUND` — RLS only |
| Roles/statuses/maintenance GET | `PERMISSION ISSUES FOUND` — likely unguarded reads |
| Feature module on audit mutations | `PERMISSION ISSUES FOUND` |
| `vendors.delete` / `assets.export` keys | unused |
| Page-level deny on admin GET | missing (empty data, not 403) |
| Field-level financial ACL inside tenant | `NOT_IMPLEMENTED` |

---

## 11. UI/UX findings

Label: `UI/UX ISSUES FOUND`

- Sidebar always shows Assets/Dashboard; vendors see a staff shell
- No asset search
- Excel labeled but not real xlsx
- QR “print” is marketing language; UI is download
- Floor vs location kind `floor` naming overlap (routes vs catalog)
- Conditions live under statuses permission; fields under categories
- Activity page shows raw action keys
- No empty-state distinction between “no permission” and “no rows” on several admin lists
- Handover module can hide custody panel while allotment remains on the asset form

Browser end-to-end clicks were **not** executed in this audit (`NOT_VERIFIED` for visual/responsive behavior).

---

## 12. Final implementation status

```text
TOTAL MODULES REVIEWED: 16 (A–P) plus marketing/CRM/storage
TOTAL FEATURES REVIEWED: 306
FULLY COMPLETED FEATURES: 160
PARTIALLY COMPLETED FEATURES: 71
FEATURES WITH BUGS: 10
FEATURES REQUIRING PRODUCTION HARDENING: 16
FEATURES NOT FOUND: 75
DATABASE TABLES REVIEWED: 39 live (+ 2 dropped)
ROUTES REVIEWED: 42 pages + 3 API + tenant login/forgot-password
MIGRATIONS REVIEWED: 41
SECURITY ISSUES FOUND: 12
PERMISSION ISSUES FOUND: 8
UI/UX ISSUES FOUND: 9
```

Three lists (completed / incomplete / not implemented) match sections 2, 3–5, and 6.

Counts classify each checklist item once. “Features with bugs” and “hardening” overlap the 71 partials; they are not extra features.

---

## List 1 – Already completed

Only items that are genuinely wired UI → action → DB (and RLS where applicable):

- Organization signup, login, logout, password reset flow
- Workspace slug, reserved slugs
- Tenant isolation (company_id + RLS + session company check)
- Logo upload, brand colors, white-label shells
- Workspace settings: asset code format
- Billing plans, subscriptions, asset caps, extra-asset orders, Razorpay integration code
- Team invitations + expiry + accept
- Custom roles and permission matrix; system Admin role
- Session middleware for dashboard/admin/tag
- Asset CRUD, auto codes, pagination, category/location/status filters
- Category, status, condition catalogs; custom fields
- Core asset fields (brand/model/serial/description/image/purchase/invoice/warranty/AMC/insurance/value)
- Attachments upload to R2 with type/expiry columns
- Location hierarchy CRUD; asset location assignment; location history; location report
- Handover, transfer, return, dispose, handover ack, lifecycle timeline
- QR generate/download; public tag page; public issue report; audit scanning
- Maintenance ticket create; status/assignee; vendor/priority/due on create
- PM plans + cron ticket generation + maintenance/warranty/AMC/insurance/document emails
- Audit create/start/complete/delete; location scope; found/missing/wrong location; remarks enforcement; progress; floor mode; audit export
- Vendor create/edit; vendor-scoped invite/login; vendor ticket RLS
- Document types catalog (seeded) used by uploader
- Main dashboard charts/tiles
- Standard CSV reports listed in `REPORT_KEYS`
- CSV asset import preview/commit/history
- In-app storage bell; email templates/rules/logs
- Cron route with bearer secret
- Super-admin companies/plans/orders/leads/storage; company deletion
- Marketing site + CRM leads
- Public tag hides financials

---

## List 2 – Existing but incomplete or defective

- Module flags without page-level deny (especially audits)
- Subscription statuses without login block
- Email pre-confirm instead of verification
- User profile without self-edit
- `is_active` without login enforcement (**bug**)
- Vendor permissions without portal UX
- Partial `audit_log` wiring
- Linked asset / accessories / multi-image / vendor FK vs text
- Fixed sort; no search
- QR print/replace/security/barcode extras
- Room/zone naming
- Ticket update limited; no plan edit/delete
- Audit photo flag (**bug**); wrong custodian auto-detect; duplicate scan overwrite
- Required documents UI (**bug**: not enforced)
- Excel export (**bug**: not xlsx)
- Failed email uniqueness vs retry (**defect**)
- Cron PM vs email race (**defect**)
- Media public GET
- Invite plaintext tokens
- Rate limit process-local; no login throttle
- Super-admin module bypass
- Direct URL admin GET leaks/empty pages
- Unguarded roles list (**permission**)
- Category required docs table unused at runtime
- `require_photo_on_exception`, `assets.vendor_id`, transfer ack columns unused in flows

---

## List 3 – Not yet implemented

- Trials, timezone, org suspension, impersonation, platform settings
- User delete, login activity
- Archive, subcategories, tags, departments, asset search, bulk UI actions
- Bulk QR, NFC/RFID, signed QR
- Expected/overdue returns
- Ticket delete/comments/attachments/costs/SLA/escalation/reopen workflow
- Audit assignee; dept/category/custodian/selected scopes; approval; comparison
- Vendor delete/documents/contracts/performance/rating
- Non-asset documents; versioning; document approval; issue date
- Separate employee/vendor dashboards
- Department/vendor/document-only reports; PDF; scheduled/custom reports
- Excel import; other entity imports; rollback; filtered/large/multi-sheet export
- Audit reminder emails; return-due reminders; approval/escalation notifications; email retry
- All approval/request/purchase/contract workflows
- Signed file URLs

---

## Companion files

- `TAGX_IMPLEMENTED_FEATURES.md` — per-feature inventory
- `TAGX_DATABASE_FEATURE_MAP.md` — tables, RLS, unused columns
- `TAGX_ROUTE_INVENTORY.md` — routes, access, direct URL notes
