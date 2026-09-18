# TagX Route Inventory

Sources: `src/app/**/page.tsx`, `src/app/api/**/route.ts`, `src/middleware.ts`. Middleware matcher excludes `/api`, `_next/static`, `_next/image`, `favicon.ico`, and image extensions.

Access model:
- **Public marketing**: no session required.
- **Tenant auth**: cookie session + `public.users` row. Middleware sets `x-company-id` / `x-role-id`. Unauthenticated hits to app shell redirect to `/{slug}/login` or `/`.
- **Super admin**: `platform_admins`. `/admin/**` redirects non-admins to `/dashboard`.
- **RBAC**: many pages hide nav via `getVisibleAdminSections`. Direct URL often still renders the page shell; mutations return errors and list actions return `[]` when `requirePermission` / `requireModule` fail. **Direct URL access is therefore not a hard deny for most admin GET pages.**

Module requirement: `FEATURE_MODULES` are `maintenance`, `audits`, `vendors`, `handover`, `preventive_maintenance`, `reports`. Disabled modules drop from the sidebar; mutating actions usually call `requireModule` except audit writes.

---

Route:
 `/`

Module:
 Marketing

Purpose:
 Landing page

User roles allowed:
 Anonymous; signed-in users still can open it

Module requirement:
 None

Main components:
 `src/components/marketing/landing-page.tsx`, site header/footer

Server actions/API used:
 None on first paint

Database tables used:
 None

Status:
 Implemented

Issues:
 None found

---

Route:
 `/signup`

Module:
 Organization and SaaS / Billing

Purpose:
 Self-serve company signup and Razorpay checkout

User roles allowed:
 Anonymous (rate-limited)

Module requirement:
 None

Main components:
 Signup page under `src/app/signup/`

Server actions/API used:
 `signupCompanyAction`, `confirmSignupPaymentAction`

Database tables used:
 `companies`, `users`, `roles`, `company_settings`, `company_subscriptions`, `billing_plans`

Status:
 Implemented

Issues:
 First user email pre-confirmed. Runtime payment `NOT_VERIFIED` without Razorpay.

---

Route:
 `/demo`

Module:
 Marketing

Purpose:
 Product demo page

User roles allowed:
 Public

Module requirement:
 None

Main components:
 `src/app/demo/page.tsx`

Server actions/API used:
 None required

Database tables used:
 None

Status:
 Implemented

Issues:
 None found

---

Route:
 `/inquire`

Module:
 CRM

Purpose:
 Lead capture

User roles allowed:
 Public (rate-limited)

Module requirement:
 None

Main components:
 `src/components/marketing/lead-form.tsx`

Server actions/API used:
 `submitLeadAction`

Database tables used:
 `crm_leads`

Status:
 Implemented

Issues:
 None found

---

Route:
 `/asset-management-system`

Module:
 Marketing / SEO

Purpose:
 SEO content page

User roles allowed:
 Public

Module requirement:
 None

Main components:
 `src/app/asset-management-system/page.tsx`

Server actions/API used:
 None

Database tables used:
 None

Status:
 Implemented

Issues:
 None found

---

Route:
 `/robots.txt`, `/sitemap.xml`, `/manifest.webmanifest`, `/opengraph-image`

Module:
 Marketing

Purpose:
 SEO and PWA files

User roles allowed:
 Public (middleware skips auth if no cookie)

Module requirement:
 None

Main components:
 App router special files

Server actions/API used:
 None

Database tables used:
 None

Status:
 Implemented

Issues:
 Not individually re-read in this pass; presence inferred from middleware allow-list. Mark extra file contents `NOT_VERIFIED`.

---

Route:
 `/{slug}/login`

Module:
 Authentication

Purpose:
 Tenant password login

User roles allowed:
 Anonymous; authenticated users redirected to `/dashboard` or `next`

Module requirement:
 None

Main components:
 Tenant login page, company branding

Server actions/API used:
 `signIn`, `getCompanyForLogin`

Database tables used:
 `companies`, `users`

Status:
 Implemented

Issues:
 No login rate limit. `users.is_active` not checked. Direct access while logged in redirects away.

---

Route:
 `/{slug}/forgot-password`

Module:
 Authentication

Purpose:
 Request password reset email

User roles allowed:
 Public

Module requirement:
 None

Main components:
 Forgot-password form

Server actions/API used:
 `requestPasswordResetAction`

Database tables used:
 Supabase Auth

Status:
 Implemented

Issues:
 Email delivery `NOT_VERIFIED`

---

Route:
 `/reset-password`

Module:
 Authentication

Purpose:
 Set new password from recovery tokens

User roles allowed:
 Holder of recovery tokens

Module requirement:
 None

Main components:
 `src/app/reset-password/page.tsx`

Server actions/API used:
 `updatePasswordAction`

Database tables used:
 Auth

Status:
 Implemented

Issues:
 None found in routing

---

Route:
 `/invite/[token]`

Module:
 Authentication / Users

Purpose:
 Accept company or vendor invite, set password

User roles allowed:
 Invitee (no session)

Module requirement:
 None

Main components:
 Invite accept page

Server actions/API used:
 `getInviteForAcceptPage`, `acceptInviteAction`

Database tables used:
 `company_invites`, `users`, `auth.users`

Status:
 Implemented

Issues:
 Token in URL stored plaintext. Expired/accepted invites rejected.

---

Route:
 `/tag/[id]`

Module:
 QR

Purpose:
 Public asset identification; optional issue report; optional audit verify if signed in

User roles allowed:
 Anonymous (limited fields). Tenant member, other-company user, super admin (read-only workspace)

Module requirement:
 None for public view. Audit verify needs `audits.edit`

Main components:
 `src/app/tag/[id]/page.tsx`, `report-form.tsx`, `audit-verify-form.tsx`, `BrandLogo`

Server actions/API used:
 `getPublicAssetForTag`, `getTagPageViewer`, `submitPublicAssetReportAction`, `getAuditTagContext`

Database tables used:
 `assets` (subset via admin client), `companies`, `maintenance_tickets`, `audits`/`audit_items`

Status:
 Implemented

Issues:
 UUID is the secret. Financials omitted. Super admin cannot open tenant asset from this page.

---

Route:
 `/dashboard`

Module:
 Reports and Dashboard

Purpose:
 Company overview tiles and charts

User roles allowed:
 Any authenticated tenant user (and super admin if they have a profile)

Module requirement:
 None (maintenance chart still queries tickets; RLS applies)

Main components:
 `src/app/(dashboard)/dashboard/page.tsx`, `SimpleBarChart`

Server actions/API used:
 `getAssetCountsByCategoryForDashboard`, `getAssetCountsByStatusForDashboard`, `getOpenMaintenanceTicketsForDashboard`, `getDashboardTilesForHome`

Database tables used:
 `assets`, `maintenance_tickets`, aggregate RPCs

Status:
 Implemented

Issues:
 Same dashboard for employee/vendor/admin. No `assets.view` check; relies on RLS.

---

Route:
 `/dashboard/administration`

Module:
 Admin

Purpose:
 Redirect to first permitted admin section or `/dashboard`

User roles allowed:
 Authenticated; redirect if no sections

Module requirement:
 Whatever the first visible section needs

Main components:
 `src/app/(dashboard)/dashboard/administration/page.tsx`

Server actions/API used:
 `getVisibleAdminSections`

Database tables used:
 `roles`, `company_settings`

Status:
 Implemented

Issues:
 None found

---

Route:
 `/dashboard/administration/users`

Module:
 Authentication and Users

Purpose:
 List users, invite, change role, toggle active

User roles allowed:
 Users with `users.view` in nav; page itself may still render if URL is known

Module requirement:
 None

Main components:
 `user-list.tsx`, `invite-user-form.tsx`, `pending-invite-list.tsx`

Server actions/API used:
 `getCompanyUsersForAdmin`, `inviteCompanyUserAction`, `updateUserRoleAction`, `toggleUserActiveAction`

Database tables used:
 `users`, `roles`, `company_invites`, `vendors`

Status:
 Implemented

Issues:
 Layout tabs hidden without `users.view`/`roles.view`. Direct URL: list actions may not all check view (invite checks `users.create`). Deactivate does not block login.

---

Route:
 `/dashboard/administration/roles`

Module:
 Authentication and Users

Purpose:
 Create roles and edit permission matrix

User roles allowed:
 `roles.view` for nav

Module requirement:
 None

Main components:
 `role-editor.tsx`, `create-role-form.tsx`

Server actions/API used:
 `getRolesForAdministration`, `createRoleAction`, `updateRolePermissionsAction`, `deleteRoleAction`

Database tables used:
 `roles`

Status:
 Implemented

Issues:
 Mutations permission-checked. GET list should be reviewed: `getRolesForAdministration` does not call `requirePermission` in the grep set — **direct URL can load role JSON for any authenticated tenant user** (RLS still company-scoped). PERMISSION ISSUE.

---

Route:
 `/dashboard/administration/categories`

Module:
 Asset Register / catalogs

Purpose:
 Category CRUD and required document keys

User roles allowed:
 `categories.view` for nav

Module requirement:
 None

Main components:
 `category-list.tsx`

Server actions/API used:
 `getCategoriesForAdmin`, category mutations, `getDocumentTypesForForm`

Database tables used:
 `asset_categories`, `category_required_documents`, `document_types`

Status:
 Implemented

Issues:
 Page-level view check not present. Required documents not enforced on assets.

---

Route:
 `/dashboard/administration/fields`

Module:
 Asset Register / custom fields

Purpose:
 Category field definitions

User roles allowed:
 `categories.view` for nav

Module requirement:
 None

Main components:
 Fields admin page

Server actions/API used:
 `getCategoryFieldsForAdmin`, field mutations

Database tables used:
 `category_fields`

Status:
 Implemented

Issues:
 Same direct-URL pattern.

---

Route:
 `/dashboard/administration/locations`

Module:
 Location Management

Purpose:
 Hierarchy CRUD

User roles allowed:
 `locations.view` for nav; `getLocationsForAdmin` checks `locations.view`

Module requirement:
 None

Main components:
 Locations admin UI

Server actions/API used:
 `getLocationsForAdmin`, create/update/delete location actions

Database tables used:
 `locations`

Status:
 Implemented

Issues:
 View-gated at action. Empty list if no permission (page still opens).

---

Route:
 `/dashboard/administration/statuses`

Module:
 Asset Register

Purpose:
 Status catalog

User roles allowed:
 `statuses.view` for nav

Module requirement:
 None

Main components:
 Statuses admin

Server actions/API used:
 `getStatusesForAdmin`, status mutations

Database tables used:
 `asset_statuses`

Status:
 Implemented

Issues:
 `getStatusesForAdmin` does not appear in requirePermission grep — possible unauthenticated-to-role data leak within tenant. PERMISSION ISSUE.

---

Route:
 `/dashboard/administration/conditions`

Module:
 Asset Register

Purpose:
 Condition catalog

User roles allowed:
 `statuses.view` for nav

Module requirement:
 None

Main components:
 Conditions admin

Server actions/API used:
 `getConditionsForAdmin`, condition mutations

Database tables used:
 `asset_conditions`

Status:
 Implemented

Issues:
 Reads may be unguarded; mutations check `statuses.*`.

---

Route:
 `/dashboard/administration/maintenance`

Module:
 Maintenance

Purpose:
 Ticket list, create, status/assignee update

User roles allowed:
 `maintenance.view` for nav; vendor role can view/edit assigned tickets via RLS

Module requirement:
 `maintenance` for nav and create/update actions

Main components:
 Maintenance admin page

Server actions/API used:
 `getMaintenanceTicketsForAdmin`, `createTicketAction`, `updateTicketAction`

Database tables used:
 `maintenance_tickets`, `assets`, `vendors`, `maintenance_types`

Status:
 Implemented

Issues:
 `getMaintenanceTicketsForAdmin` has no requirePermission in grep — list may load for any tenant user who knows the URL (RLS still applies). Cannot delete tickets. Cannot edit title after create.

---

Route:
 `/dashboard/administration/maintenance/plans`

Module:
 Maintenance / PM

Purpose:
 Create and list preventive plans

User roles allowed:
 `maintenance.view` + PM feature for nav

Module requirement:
 `preventive_maintenance` (nav + get/create actions)

Main components:
 Plans page

Server actions/API used:
 `getMaintenancePlansForAdmin`, `createPlanAction`

Database tables used:
 `maintenance_plans`

Status:
 Implemented

Issues:
 No update/delete plan actions found.

---

Route:
 `/dashboard/administration/vendors`

Module:
 Vendor Management

Purpose:
 Create/edit vendors

User roles allowed:
 `vendors.view` + vendors module for nav and list action

Module requirement:
 `vendors`

Main components:
 Vendor list/forms

Server actions/API used:
 `getVendorsForAdmin`, `createVendorAction`, `updateVendorAction`

Database tables used:
 `vendors`

Status:
 Implemented

Issues:
 No delete. `vendors.delete` unused.

---

Route:
 `/dashboard/administration/audits`

Module:
 Audit Management

Purpose:
 Campaign list and create

User roles allowed:
 `audits.view` for list action; `audits.create` for form

Module requirement:
 `audits` (nav only; create action does not call `requireModule`)

Main components:
 `create-audit-form.tsx`

Server actions/API used:
 `getAuditsForAdmin`, `createAuditAction`

Database tables used:
 `audits`, `audit_items`, `locations`

Status:
 Implemented

Issues:
 Direct URL with audits module disabled: create may still work if user has `audits.create`. List is permission-checked.

---

Route:
 `/dashboard/administration/audits/[id]`

Module:
 Audit Management

Purpose:
 Campaign detail, start/complete/delete, scan/missing/resolve, export

User roles allowed:
 `audits.view` for detail fetch; edit/delete buttons gated

Module requirement:
 Nav: `audits`. Actions: permission only

Main components:
 Audit detail page, scan components

Server actions/API used:
 `getAuditDetail`, `startAuditAction`, `completeAuditAction`, `deleteAuditAction`, `recordAuditScanAction`, `markMissingAction`, `resolveAuditItemAction`, `exportAuditResultsAction`

Database tables used:
 `audits`, `audit_items`

Status:
 Implemented

Issues:
 Photo-on-exception not enforced. Duplicate scans overwrite.

---

Route:
 `/dashboard/administration/reports`

Module:
 Reports / Import

Purpose:
 Standard exports and CSV asset import

User roles allowed:
 `reports.view` for jobs list; `reports.export` to download; `assets.create` to import

Module requirement:
 `reports`

Main components:
 `reports-admin.tsx`

Server actions/API used:
 `exportReportAction`, `previewImportAction`, `commitImportAction`, `getImportJobsForAdmin`

Database tables used:
 `assets`, tickets, audits, `import_jobs`

Status:
 Implemented

Issues:
 Excel option is XML `.xls`. Page may render without view check; actions return empty/errors.

---

Route:
 `/dashboard/administration/notifications`

Module:
 Notifications and Emails

Purpose:
 Templates, rules, logs, test email

User roles allowed:
 `notifications.view` for reads; `notifications.edit` for writes

Module requirement:
 None (always in admin catalog)

Main components:
 Notifications admin page

Server actions/API used:
 `getEmailTemplatesForAdmin`, `updateEmailTemplateAction`, `toggleNotificationRuleAction`, `sendTestEmailAction`, log queries

Database tables used:
 `email_templates`, `notification_rules`, `notification_logs`

Status:
 Implemented

Issues:
 Test email rate-limited. No per-user preferences.

---

Route:
 `/dashboard/administration/activity`

Module:
 Security / Admin

Purpose:
 Recent `audit_log` entries

User roles allowed:
 `settings.view` (action gated)

Module requirement:
 None

Main components:
 Activity list

Server actions/API used:
 `getAuditLogForAdmin`

Database tables used:
 `audit_log`

Status:
 Implemented

Issues:
 Incomplete event coverage. Page still opens with empty list if no permission.

---

Route:
 `/dashboard/administration/settings`

Module:
 Organization and SaaS

Purpose:
 Branding, asset code format, modules, billing extras

User roles allowed:
 `settings.view` for nav; `settings.edit` for form

Module requirement:
 None

Main components:
 Workspace settings form

Server actions/API used:
 `getWorkspaceSettingsForAdmin`, `updateWorkspaceSettingsAction`, `updateCompanyBrandingAction`, `getCurrentCompanyQuota`, extra-asset payment actions

Database tables used:
 `companies`, `company_settings`, `company_subscriptions`, `billing_orders`

Status:
 Implemented

Issues:
 Page loads for viewers; edit gated. No timezone.

---

Route:
 `/assets`

Module:
 Asset Register

Purpose:
 Paginated list with filters

User roles allowed:
 Any authenticated user in dashboard layout (sidebar always shows Assets)

Module requirement:
 None

Main components:
 `asset-filters.tsx`, table/mobile list

Server actions/API used:
 `getAssetsForList`, `getAssetFilterOptionsForList`, `getCurrentCompanyQuota`

Database tables used:
 `assets`, catalogs

Status:
 Implemented

Issues:
 **No `assets.view` check.** Vendor sees RLS-filtered rows. No search, no bulk actions. PERMISSION / UX.

---

Route:
 `/assets/new`

Module:
 Asset Register

Purpose:
 Create asset

User roles allowed:
 Authenticated; create action requires `assets.create`; quota may block

Module requirement:
 None

Main components:
 `asset-form.tsx`

Server actions/API used:
 `getAssetFormOptionsForForm`, `createAssetAction`, `getCurrentCompanyQuota`

Database tables used:
 `assets`, catalogs, `company_settings`

Status:
 Implemented

Issues:
 Page may render the form without a view/create check; submit fails without `assets.create`.

---

Route:
 `/assets/[id]`

Module:
 Asset Register / Custody / QR / Documents

Purpose:
 View/edit asset, QR, attachments, handover/return/transfer/dispose, timeline

User roles allowed:
 Authenticated; delete button uses `assets.delete`; handover UI uses `requireModule("handover")`

Module requirement:
 `handover` for custody panel

Main components:
 Asset form, `qr-tag.tsx`, `attachment-uploader.tsx`, custody panel

Server actions/API used:
 `getAssetDetail`, update/delete, QR mark, attachments, custody actions, location history, lifecycle

Database tables used:
 `assets`, documents, location history, custody tables

Status:
 Implemented

Issues:
 Detail fetch `getAssetDetail` does not call `requirePermission` (RLS). Vendor cannot update assets (RLS WITH CHECK).

---

Route:
 `/floor`

Module:
 Audit Management

Purpose:
 Redirect to `/floor/audits`

User roles allowed:
 Authenticated (floor layout)

Module requirement:
 None at layout

Main components:
 `src/app/(floor)/floor/page.tsx`

Server actions/API used:
 None

Database tables used:
 None

Status:
 Implemented

Issues:
 Layout does not require `audits.view`.

---

Route:
 `/floor/audits`

Module:
 Audit Management

Purpose:
 Active campaigns for walk mode

User roles allowed:
 Authenticated; list action requires `audits.view`

Module requirement:
 Nav in desk sidebar is `audits` module; floor route still reachable

Main components:
 Floor audits list

Server actions/API used:
 `getActiveAuditsForFloor`

Database tables used:
 `audits`

Status:
 Implemented

Issues:
 Direct URL with module disabled still works if user has `audits.view`.

---

Route:
 `/floor/audits/[id]`

Module:
 Audit Management

Purpose:
 Phone scan UI

User roles allowed:
 `audits.view` to load; `audits.edit` to record

Module requirement:
 Same as floor audits

Main components:
 `audit-scan-form.tsx`, `qr-camera-scanner.tsx`

Server actions/API used:
 `getAuditDetail`, `lookupAuditScanAction`, `recordAuditScanAction`

Database tables used:
 `audits`, `audit_items`

Status:
 Implemented

Issues:
 BarcodeDetector availability depends on browser (`NOT_VERIFIED` per device).

---

Route:
 `/admin/login`

Module:
 Super Admin

Purpose:
 Platform admin login

User roles allowed:
 Anonymous; super admin redirected to `/admin`

Module requirement:
 None

Main components:
 Admin login page

Server actions/API used:
 `signInSuperAdmin`

Database tables used:
 `platform_admins`

Status:
 Implemented

Issues:
 Tenant credentials cannot pass the platform_admins check. No login rate limit.

---

Route:
 `/admin/forgot-password`

Module:
 Super Admin

Purpose:
 Admin password reset request

User roles allowed:
 Public

Module requirement:
 None

Main components:
 Admin forgot-password page

Server actions/API used:
 `requestPasswordResetAction`

Database tables used:
 Auth

Status:
 Implemented

Issues:
 Same as tenant reset delivery `NOT_VERIFIED`

---

Route:
 `/admin`

Module:
 Super Admin

Purpose:
 Company list and detail (plan assign, extra assets, delete)

User roles allowed:
 Super admin only (layout + middleware)

Module requirement:
 None

Main components:
 Companies page, `company-detail-dialog.tsx`

Server actions/API used:
 `listCompaniesForAdmin`, `updateCompanyAction`, `deleteCompanyAction`, billing assign/grant

Database tables used:
 `companies`, `company_subscriptions`, `billing_plans`

Status:
 Implemented

Issues:
 Direct URL for non-admin redirects to `/dashboard`. No impersonation.

---

Route:
 `/admin/companies/new`

Module:
 Super Admin

Purpose:
 Provision company + admin invite

User roles allowed:
 Super admin

Module requirement:
 None

Main components:
 New company form

Server actions/API used:
 `createCompanyAction`

Database tables used:
 `companies`, `roles`, `company_invites`, catalogs seed

Status:
 Implemented

Issues:
 Invite URL shown if email fails.

---

Route:
 `/admin/leads`

Module:
 CRM

Purpose:
 Lead inbox

User roles allowed:
 Super admin

Module requirement:
 None

Main components:
 Leads page

Server actions/API used:
 `getLeadsForAdmin`, `updateLeadAction`

Database tables used:
 `crm_leads`

Status:
 Implemented

Issues:
 None found

---

Route:
 `/admin/plans`

Module:
 Billing

Purpose:
 Plan CRUD

User roles allowed:
 Super admin

Module requirement:
 None

Main components:
 Plans admin

Server actions/API used:
 `getAllPlansForAdmin`, plan mutations

Database tables used:
 `billing_plans`

Status:
 Implemented

Issues:
 None found

---

Route:
 `/admin/orders`

Module:
 Billing

Purpose:
 Extra-asset order fulfill/cancel

User roles allowed:
 Super admin

Module requirement:
 None

Main components:
 Orders page

Server actions/API used:
 `getPendingBillingOrdersForAdmin`, fulfill/cancel

Database tables used:
 `billing_orders`

Status:
 Implemented

Issues:
 None found

---

Route:
 `/admin/storage`

Module:
 Super Admin / Storage

Purpose:
 Per-company storage usage

User roles allowed:
 Super admin (`getStorageUsageForAdmin` returns [] otherwise)

Module requirement:
 None

Main components:
 Storage table

Server actions/API used:
 `getStorageUsageForAdmin`

Database tables used:
 `company_settings`, R2 listing

Status:
 Implemented

Issues:
 None found

---

Route:
 `/api/cron/notifications`

Module:
 Notifications / PM

Purpose:
 Generate due PM tickets, storage warning emails, scheduled reminders

User roles allowed:
 Bearer `CRON_SECRET` only (GET and POST)

Module requirement:
 None

Main components:
 `src/app/api/cron/notifications/route.ts`

Server actions/API used:
 `generateDuePlanTickets`, `sendPendingStorageWarningEmails`, `runScheduledReminders`

Database tables used:
 plans, tickets, notifications, email tables, assets, documents

Status:
 Implemented

Issues:
 Middleware does not wrap `/api`. Missing secret → 401 (fail closed). Parallel Promise.all race with same-day PM tickets vs due emails. `CRON_SECRET` absent from `.env.example`.

---

Route:
 `/api/razorpay/webhook`

Module:
 Billing

Purpose:
 Razorpay events

User roles allowed:
 Razorpay signature

Module requirement:
 None

Main components:
 `src/app/api/razorpay/webhook/route.ts`

Server actions/API used:
 `handleRazorpayWebhookAction`

Database tables used:
 `razorpay_webhook_events`, `company_subscriptions`, `billing_orders`

Status:
 Implemented

Issues:
 Signature verification in `src/lib/razorpay.ts`. Runtime `NOT_VERIFIED`.

---

Route:
 `/api/media/[...key]`

Module:
 File upload / QR / branding

Purpose:
 Stream R2 object bytes

User roles allowed:
 **Unauthenticated.** Key must match `companies/{uuid}/...`

Module requirement:
 None

Main components:
 `src/app/api/media/[...key]/route.ts`

Server actions/API used:
 `getCompanyMediaObject`

Database tables used:
 None (R2)

Status:
 Implemented

Issues:
 No session, no expiry. Relies on unguessable keys. `Cache-Control: public, max-age=3600`. Signed URLs NOT_FOUND.

---

## Direct URL access summary

| Area | Logged-out | Wrong tenant role | Module disabled | Super admin |
| --- | --- | --- | --- | --- |
| `/dashboard`, `/assets`, `/floor` | Redirect login | Shell renders; RLS + some action gates | Floor/audits still reachable | If they have `users` profile, they enter tenant; else headers may lack company id |
| `/admin/**` | Redirect `/admin/login` | Redirect `/dashboard` | N/A | Allowed |
| `/tag/[id]` | Public subset | Public subset + limited CTAs | N/A | Read-only tag |
| `/api/media` | Allowed if key valid | Allowed | N/A | Allowed |
| Admin GET pages | Redirect login | Often **page HTML with empty data** | Often **still open** if RBAC allows | Bypass RBAC |

Issues:
- Nav is not authorization.
- Asset list and several catalog GET actions skip `requirePermission`.
- Audit module flag is not checked in audit mutations.
