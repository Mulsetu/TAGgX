# TagX Implemented Features

Inventory of what exists in the current codebase. Status values: `COMPLETED`, `PARTIALLY_COMPLETED`, `NOT_FOUND`. Runtime behavior that cannot be confirmed from code is marked `NOT_VERIFIED` in Notes.

Reviewed: 42 `page.tsx` files, 3 API routes, 41 SQL migrations, 96 module files under `src/modules`, middleware, permission taxonomy, RLS policies, cron, R2, Brevo, and Razorpay.

---

## 1. Organization and SaaS

### Feature: Organization Signup
Status: COMPLETED

What exists:
- Public `/signup` creates a company, Admin role, first user, default catalogs, and a Razorpay subscription checkout when a paid plan is selected.
- Rate-limited (5 signups per IP per hour, process-local).

Relevant files:
- `src/modules/billing/actions.ts` (`signupCompanyAction`, `confirmSignupPaymentAction`)
- `src/app/signup/page.tsx`

Relevant routes:
- `/signup`

Database tables:
- `companies`, `company_settings`, `company_subscriptions`, `roles`, `users`, `billing_plans`

Permissions:
- Public (unauthenticated). Company/role are derived server-side, not from the client.

Notes:
- First admin is created with `email_confirm: true` (no separate verification email).

### Feature: Organization Login
Status: COMPLETED

What exists:
- Tenant login at `/{slug}/login`. Session must belong to that company's `users` row or sign-in is rejected.

Relevant files:
- `src/modules/users/actions.ts` (`signIn`)
- `src/app/(tenant)/[slug]/login/page.tsx`
- `src/middleware.ts`

Relevant routes:
- `/{slug}/login`

Database tables:
- `companies`, `users`, `auth.users`

Permissions:
- Unauthenticated until credentials succeed; then tenant cookie `tagx-tenant-slug` is set.

Notes:
- `users.is_active` is not checked at login (see User activation).

### Feature: Tenant/company isolation
Status: COMPLETED

What exists:
- Every tenant table has `company_id`. RLS uses `current_company_id()` from the session's `users` row. Middleware copies `company_id` and `role_id` onto request headers after verifying the session. Actions must not trust a client-supplied company id.

Relevant files:
- `src/middleware.ts`
- `src/lib/permissions/has-permission.ts`
- `supabase/migrations/0002_platform_admins_and_helpers.sql`

Relevant routes:
- All authenticated app routes

Database tables:
- All tenant-owned tables

Permissions:
- Super-admin bypass policies exist alongside tenant policies.

Notes:
- Vendor users are further scoped by `current_vendor_id()` on `assets` and `maintenance_tickets`.

### Feature: Workspace slug
Status: COMPLETED

What exists:
- Unique slug on `companies` with format check. Reserved slugs table. Login, branding, and invite URLs use the slug.

Relevant files:
- `src/lib/tenant.ts`
- `supabase/migrations/0003_companies.sql`, `0004_reserved_slugs.sql`

Relevant routes:
- `/{slug}/login`, `/{slug}/forgot-password`

Database tables:
- `companies`, `reserved_slugs`

Permissions:
- N/A (identity of the tenant)

Notes:
- None.

### Feature: White-label branding
Status: COMPLETED

What exists:
- Logo, primary color, and secondary color apply to login, dashboard shell, floor audit header, public tag page, and printed QR context via CSS variables.

Relevant files:
- `src/modules/companies/actions.ts` (`updateCompanyBrandingAction`)
- `src/lib/color.ts`
- `src/components/layout/brand-logo.tsx`

Relevant routes:
- `/{slug}/login`, `/dashboard/**`, `/floor/**`, `/tag/[id]`

Database tables:
- `companies.logo_url`, `primary_color`, `secondary_color`

Permissions:
- `settings.edit` for tenant branding updates.

Notes:
- Favicon/metadata use company branding via `companyPageMetadata`.

### Feature: Logo upload
Status: COMPLETED

What exists:
- Logo uploaded to Cloudflare R2 under the company prefix; URL stored on `companies.logo_url`. Served through `/api/media/...`.

Relevant files:
- `src/modules/companies/actions.ts`
- `src/modules/storage/mutations.ts`
- `src/app/api/media/[...key]/route.ts`

Relevant routes:
- `/dashboard/administration/settings`

Database tables:
- `companies`

Permissions:
- `settings.edit`

Notes:
- Media route does not require a session; security is unguessable UUID object keys.

### Feature: Brand colors
Status: COMPLETED

What exists:
- Hex `#RRGGBB` colors validated in Zod and SQL check constraints.

Relevant files:
- `src/modules/companies/validation.ts`
- `supabase/migrations/0013_companies_branding.sql`

Relevant routes:
- `/dashboard/administration/settings`

Database tables:
- `companies.primary_color`, `companies.secondary_color`

Permissions:
- `settings.edit`

Notes:
- None.

### Feature: Organization profile
Status: PARTIALLY_COMPLETED

What exists:
- Company name, slug, branding, dedicated-infra flag (super admin), asset-code format, enabled modules.

Relevant files:
- `src/modules/companies/types.ts`
- `src/app/(dashboard)/dashboard/administration/settings/page.tsx`
- `src/app/(admin)/admin/(protected)/company-detail-dialog.tsx`

Relevant routes:
- `/dashboard/administration/settings`, `/admin`

Database tables:
- `companies`, `company_settings`

Permissions:
- Tenant: `settings.edit`. Platform: super admin.

Notes:
- No address, timezone, locale, or legal-entity fields.

### Feature: Organization settings
Status: COMPLETED

What exists:
- Workspace settings UI: asset code format, feature modules, branding, extra-asset purchase.

Relevant files:
- `src/modules/companies/actions.ts` (`getWorkspaceSettingsForAdmin`, `updateWorkspaceSettingsAction`)

Relevant routes:
- `/dashboard/administration/settings`

Database tables:
- `company_settings.enabled_modules`, `asset_code_format`

Permissions:
- `settings.view` / `settings.edit`

Notes:
- Storage limit lives on `company_settings` but is not a tenant-editable preference.

### Feature: Subscription plans
Status: COMPLETED

What exists:
- Platform plans with monthly price, currency, asset cap, extra-pack size/price, active flag, sort order. Super-admin CRUD. Public pricing on signup.

Relevant files:
- `src/modules/billing/actions.ts`
- `src/app/(admin)/admin/(protected)/plans/page.tsx`

Relevant routes:
- `/admin/plans`, `/signup`

Database tables:
- `billing_plans`, `company_subscriptions`

Permissions:
- Super admin for plan management. `anon`/`authenticated` can read active plans.

Notes:
- None.

### Feature: Billing
Status: COMPLETED

What exists:
- Per-company subscription, extra-asset orders, fulfill/cancel in super admin, tenant request extra assets with Razorpay.

Relevant files:
- `src/modules/billing/actions.ts`
- `src/app/(admin)/admin/(protected)/orders/page.tsx`

Relevant routes:
- `/admin/orders`, `/dashboard/administration/settings`

Database tables:
- `company_subscriptions`, `billing_orders`

Permissions:
- Super admin for fulfill/assign. Tenant `settings.edit` to buy extras.

Notes:
- No invoices/tax/GST documents in-app.

### Feature: Razorpay integration
Status: COMPLETED

What exists:
- Plan subscriptions and extra-asset orders. Signature verification for payments, subscriptions, and webhooks. Webhook event table for idempotency.

Relevant files:
- `src/lib/razorpay.ts`
- `src/modules/billing/payments.ts`
- `src/app/api/razorpay/webhook/route.ts`

Relevant routes:
- `/api/razorpay/webhook`
- `/signup` checkout

Database tables:
- `company_subscriptions`, `billing_orders`, `razorpay_webhook_events`

Permissions:
- Webhook authenticated by Razorpay signature, not user session.

Notes:
- Runtime payment success is `NOT_VERIFIED` (depends on live Razorpay keys).

### Feature: Plan restrictions
Status: COMPLETED

What exists:
- Asset create blocked when `assetCount >= plan.assetLimit + extraAssets`. New-asset page shows limit UI.

Relevant files:
- `src/modules/billing/actions.ts` (`assertCanCreateAsset`, `getCurrentCompanyQuota`)
- `src/app/(dashboard)/assets/new/page.tsx`

Relevant routes:
- `/assets/new`

Database tables:
- `billing_plans`, `company_subscriptions`, `assets`

Permissions:
- Enforced in `createAssetAction` after `assets.create`.

Notes:
- Quota is assets only. No per-module plan SKUs.

### Feature: Subscription status
Status: COMPLETED

What exists:
- Statuses: `pending_payment`, `active`, `past_due`, `halted`, `canceled` (app types). Webhook updates subscription.

Relevant files:
- `src/modules/billing/types.ts`
- `src/modules/billing/payments.ts`

Relevant routes:
- `/api/razorpay/webhook`

Database tables:
- `company_subscriptions.status`

Permissions:
- Super admin write; tenant select.

Notes:
- Original migration allowed only `active`/`canceled`; later Razorpay migration expanded statuses. Halted/past_due enforcement on login is `NOT_VERIFIED` beyond asset quota.

### Feature: Trial logic
Status: NOT_FOUND

What exists:
- No trial length, trial status, or trial expiry job.

Relevant files:
- None

Relevant routes:
- None

Database tables:
- None

Permissions:
- N/A

Notes:
- Signup goes to paid Razorpay or super-admin assigned plan.

### Feature: Module enable/disable
Status: PARTIALLY_COMPLETED

What exists:
- `company_settings.enabled_modules` JSON for `maintenance`, `audits`, `vendors`, `handover`, `preventive_maintenance`, `reports`. Sidebar/admin sections hide disabled modules. Mutating actions call `requireModule`.

Relevant files:
- `src/lib/permissions/feature-catalog.ts`
- `src/lib/permissions/features.ts`
- `src/lib/permissions/admin-sections.ts`

Relevant routes:
- `/dashboard/administration/settings`

Database tables:
- `company_settings.enabled_modules`

Permissions:
- `settings.edit` to change flags. Feature modules are separate from RBAC.

Notes:
- Direct URL access to several admin pages still renders the shell; list actions return empty arrays when the module is off, but there is no page-level redirect for audits/maintenance reads. Super admins always see modules as enabled.

### Feature: Organization timezone
Status: NOT_FOUND

What exists:
- Dates formatted with `en-IN` in a few UIs. No timezone column or picker.

Relevant files:
- None

Relevant routes:
- None

Database tables:
- None

Permissions:
- N/A

Notes:
- Cron runs at 06:00 UTC (`vercel.json`).

### Feature: Organization preferences
Status: PARTIALLY_COMPLETED

What exists:
- Asset code format and enabled modules.

Relevant files:
- `src/modules/companies/actions.ts`

Relevant routes:
- `/dashboard/administration/settings`

Database tables:
- `company_settings`

Permissions:
- `settings.edit`

Notes:
- No locale, date format, currency preference (purchase price is numeric without company currency after 0017 dropped `currency`).

---

## 2. Authentication and Users

### Feature: Login
Status: COMPLETED

What exists:
- Tenant password login and separate super-admin login.

Relevant files:
- `src/modules/users/actions.ts`

Relevant routes:
- `/{slug}/login`, `/admin/login`

Database tables:
- `users`, `platform_admins`

Permissions:
- Tenant membership checked against company slug.

Notes:
- No login rate limit. No CAPTCHA.

### Feature: Signup
Status: COMPLETED

What exists:
- Self-serve company signup (see Organization Signup). Team members join via invite, not open signup.

Relevant files:
- `src/modules/billing/actions.ts`
- `src/modules/users/mutations.ts` (`createCompanyAdminAccount`)

Relevant routes:
- `/signup`, `/invite/[token]`

Database tables:
- `companies`, `users`, `company_invites`

Permissions:
- N/A

Notes:
- None.

### Feature: Logout
Status: COMPLETED

What exists:
- `signOutAction` with tenant vs admin redirect.

Relevant files:
- `src/modules/users/actions.ts`
- `src/components/layout/sign-out-button.tsx`

Relevant routes:
- Dashboard, floor, admin shells

Database tables:
- Auth session only

Permissions:
- Authenticated

Notes:
- None.

### Feature: Password reset
Status: COMPLETED

What exists:
- Forgot-password pages for tenant and admin. Reset page consumes recovery tokens from the URL hash.

Relevant files:
- `src/modules/users/actions.ts` (`requestPasswordResetAction`, `updatePasswordAction`)
- `src/app/reset-password/page.tsx`

Relevant routes:
- `/{slug}/forgot-password`, `/admin/forgot-password`, `/reset-password`

Database tables:
- Supabase Auth

Permissions:
- Public reset request

Notes:
- Email delivery depends on Supabase Auth SMTP configuration (`NOT_VERIFIED` in this environment).

### Feature: Email verification
Status: PARTIALLY_COMPLETED

What exists:
- Invite accept and signup create users with `email_confirm: true`. Opening the invite link is treated as proof of inbox control.

Relevant files:
- `src/modules/users/mutations.ts`

Relevant routes:
- `/invite/[token]`, `/signup`

Database tables:
- `auth.users`

Permissions:
- N/A

Notes:
- No confirm-email page, resend, or pending-verification gate.

### Feature: User profile
Status: PARTIALLY_COMPLETED

What exists:
- `users.full_name` stored. Shown in user menu. Set on signup. No self-service profile edit page.

Relevant files:
- `src/modules/users/types.ts`
- `src/components/layout/user-menu.tsx`

Relevant routes:
- None dedicated

Database tables:
- `users.full_name`, `users.email`

Permissions:
- N/A

Notes:
- Admins can change another user's role and active flag, not their own profile fields.

### Feature: Team invitations
Status: COMPLETED

What exists:
- Admin invites by email + role. Optional vendor binding. Invite URL shown if email fails. Pending invites listed.

Relevant files:
- `src/modules/users/actions.ts` (`inviteCompanyUserAction`)
- `src/app/(dashboard)/dashboard/administration/(users-and-roles)/users/invite-user-form.tsx`

Relevant routes:
- `/dashboard/administration/users`, `/invite/[token]`

Database tables:
- `company_invites`

Permissions:
- `users.create`

Notes:
- Token stored in plaintext (32 random bytes hex).

### Feature: Invitation expiry
Status: COMPLETED

What exists:
- `expires_at` default now + 7 days. Accept page and action reject expired/accepted invites.

Relevant files:
- `src/modules/users/queries.ts`
- `supabase/migrations/0022_company_invites.sql`

Relevant routes:
- `/invite/[token]`

Database tables:
- `company_invites.expires_at`, `accepted_at`

Permissions:
- N/A

Notes:
- No resend-invite action found.

### Feature: User activation/deactivation
Status: PARTIALLY_COMPLETED

What exists:
- `toggleUserActiveAction` updates `users.is_active`. UI on user list.

Relevant files:
- `src/modules/users/actions.ts`
- `src/app/(dashboard)/dashboard/administration/(users-and-roles)/users/user-list.tsx`

Relevant routes:
- `/dashboard/administration/users`

Database tables:
- `users.is_active`

Permissions:
- `users.edit`

Notes:
- `signIn` does not read `is_active`. A deactivated user can still authenticate if they have a password.

### Feature: User removal
Status: NOT_FOUND

What exists:
- No delete-user action. Deactivate is the only off-boarding control.

Relevant files:
- None

Relevant routes:
- None

Database tables:
- `users` has ON DELETE cascade from `auth.users`, but no app path deletes auth users for tenants.

Permissions:
- N/A

Notes:
- Super admin can delete an entire company.

### Feature: User roles
Status: COMPLETED

What exists:
- Per-company roles. System Admin and Vendor roles seeded. Users assigned a `role_id`.

Relevant files:
- `src/modules/roles/actions.ts`
- `src/modules/users/actions.ts` (`updateUserRoleAction`)

Relevant routes:
- `/dashboard/administration/roles`, `/dashboard/administration/users`

Database tables:
- `roles`, `users.role_id`

Permissions:
- `roles.view/create/edit/delete`, `users.edit`

Notes:
- None.

### Feature: Custom roles
Status: COMPLETED

What exists:
- Create role with name/description. Permission matrix editor. Delete non-system roles.

Relevant files:
- `src/app/(dashboard)/dashboard/administration/(users-and-roles)/roles/role-editor.tsx`

Relevant routes:
- `/dashboard/administration/roles`

Database tables:
- `roles.permissions` jsonb

Permissions:
- `roles.create/edit/delete`

Notes:
- None.

### Feature: Permissions
Status: COMPLETED

What exists:
- Modules: assets, categories, locations, statuses, maintenance, users, roles, audits, notifications, settings, vendors, handover, reports. Actions: view, create, edit, delete, assign, export.

Relevant files:
- `src/lib/permissions/taxonomy.ts`
- `src/lib/permissions/has-permission.ts`

Relevant routes:
- Role editor; enforced in server actions

Database tables:
- `roles.permissions`

Permissions:
- Super admin bypasses all checks.

Notes:
- Conditions catalog uses `statuses` permission module. Asset fields use `categories`.

### Feature: Admin permissions
Status: COMPLETED

What exists:
- System Admin role backfilled with all module/actions including assign/export.

Relevant files:
- `supabase/migrations/0036_platform_controls.sql`

Relevant routes:
- `/dashboard/administration/**`

Database tables:
- `roles`

Permissions:
- Full map for Admin

Notes:
- None.

### Feature: Vendor permissions
Status: PARTIALLY_COMPLETED

What exists:
- System Vendor role: `maintenance.view/edit`, `assets.view`. `users.vendor_id` plus RLS so vendors only see their tickets and related assets. Vendors cannot insert/update assets (`WITH CHECK` requires `current_vendor_id() is null`).

Relevant files:
- `supabase/migrations/0038_vendors_pm.sql`
- `src/modules/users/actions.ts` invite `vendorId`

Relevant routes:
- Same tenant app (`/dashboard`, `/assets`, `/dashboard/administration/maintenance`)

Database tables:
- `users.vendor_id`, `vendors`, `maintenance_tickets.vendor_id`, `assets.vendor_id`

Permissions:
- Vendor role + RLS

Notes:
- No separate vendor portal routes. Sidebar still offers Assets/Dashboard. Page-level hiding for non-vendor nav is incomplete.

### Feature: Session handling
Status: COMPLETED

What exists:
- Supabase cookie session in middleware. Transient auth errors do not wipe cookies. Post-login `next` path sanitized.

Relevant files:
- `src/middleware.ts`
- `src/lib/supabase/middleware.ts`
- `src/lib/paths.ts`

Relevant routes:
- Matcher excludes `api`, static, images

Permissions:
- N/A

Notes:
- `/api/*` is not session-gated by middleware.

### Feature: Login activity
Status: NOT_FOUND

What exists:
- No login history table or last-login UI.

Relevant files:
- None

Relevant routes:
- None

Database tables:
- None

Permissions:
- N/A

Notes:
- `audit_log` can store IP on mutations, not on login.

### Feature: User activity log
Status: PARTIALLY_COMPLETED

What exists:
- `audit_log` append-only via service role. Activity page lists recent entries. Wired on custody, vendors, some catalogs, email templates, workspace settings, import, maintenance create — not on asset CRUD or login.

Relevant files:
- `src/lib/audit-log.ts`
- `src/modules/activity/actions.ts`
- `src/app/(dashboard)/dashboard/administration/activity/page.tsx`

Relevant routes:
- `/dashboard/administration/activity`

Database tables:
- `audit_log`

Permissions:
- `settings.view`

Notes:
- Tenant members can SELECT; no INSERT policy for `authenticated`.

---

## 3. Asset Register

### Feature: Create asset
Status: COMPLETED

What exists:
- Form with validation, quota check, auto code, custom fields, location move recorded on create.

Relevant files:
- `src/modules/assets/actions.ts` (`createAssetAction`)
- `src/app/(dashboard)/assets/new/page.tsx`

Relevant routes:
- `/assets/new`

Database tables:
- `assets`, `company_settings.next_asset_sequence`

Permissions:
- `assets.create`

Notes:
- `writeAuditLog` is not called on create.

### Feature: View asset
Status: COMPLETED

What exists:
- Detail page: fields, QR, attachments, location history, custody panel, lifecycle events.

Relevant files:
- `src/app/(dashboard)/assets/[id]/page.tsx`

Relevant routes:
- `/assets/[id]`

Database tables:
- `assets` and related

Permissions:
- List/detail queries rely on RLS; location history checks `assets.view`. List itself does not call `requirePermission`.

Notes:
- Direct URL `/assets` is always in the sidebar for signed-in tenant users.

### Feature: Edit asset
Status: COMPLETED

What exists:
- Same form on detail page. Location changes write `asset_location_history`.

Relevant files:
- `src/modules/assets/actions.ts` (`updateAssetAction`)

Relevant routes:
- `/assets/[id]`

Database tables:
- `assets`, `asset_location_history`

Permissions:
- `assets.edit`

Notes:
- No audit_log row on edit.

### Feature: Delete asset
Status: COMPLETED

What exists:
- Deletes DB row and R2 files; adjusts storage counter.

Relevant files:
- `src/modules/assets/actions.ts` (`deleteAssetAction`)

Relevant routes:
- `/assets/[id]`

Database tables:
- `assets`, `asset_documents`

Permissions:
- `assets.delete`

Notes:
- Hard delete, not archive.

### Feature: Archive asset
Status: NOT_FOUND

What exists:
- No archived flag or archive action. Status catalog can include retired/disposed/lost (`is_final`).

Relevant files:
- `supabase/migrations/0036_platform_controls.sql`

Relevant routes:
- None

Database tables:
- `asset_statuses.is_final`

Permissions:
- N/A

Notes:
- Disposal exists as a custody action that sets a final status.

### Feature: Asset code
Status: COMPLETED

What exists:
- Unique per company. Shown on list, detail, QR filename, tag page.

Relevant files:
- `src/modules/assets/mutations.ts`

Relevant routes:
- `/assets`

Database tables:
- `assets.asset_code` unique `(company_id, asset_code)`

Permissions:
- N/A

Notes:
- None.

### Feature: Automatic asset code generation
Status: COMPLETED

What exists:
- `increment_asset_sequence` RPC + `asset_code_format` template (e.g. `AST-{SEQ:05d}`). Category `code_prefix` can prefix codes.

Relevant files:
- `src/modules/assets/mutations.ts` (`generateAssetCode`)
- `supabase/migrations/0017_assets_field_redesign.sql`

Relevant routes:
- `/dashboard/administration/settings`

Database tables:
- `company_settings.asset_code_format`, `next_asset_sequence`
- `asset_categories.code_prefix`

Permissions:
- `settings.edit` for format

Notes:
- None.

### Feature: Asset category
Status: COMPLETED

What exists:
- CRUD categories, active flag, default status/condition, required document keys.

Relevant files:
- `src/modules/categories/actions.ts`

Relevant routes:
- `/dashboard/administration/categories`

Database tables:
- `asset_categories`

Permissions:
- `categories.*`

Notes:
- None.

### Feature: Asset subcategory
Status: NOT_FOUND

What exists:
- No parent category / subcategory model.

Relevant files:
- None

Relevant routes:
- None

Database tables:
- None

Permissions:
- N/A

Notes:
- None.

### Feature: Asset status
Status: COMPLETED

What exists:
- Per-company status catalog with color, `is_final`, `allows_assignment`.

Relevant files:
- `src/modules/statuses/actions.ts`

Relevant routes:
- `/dashboard/administration/statuses`

Database tables:
- `asset_statuses`, `assets.status_id`

Permissions:
- `statuses.*`

Notes:
- Original `assets.status` enum was replaced by `status_id` (migration 0023).

### Feature: Asset condition
Status: COMPLETED

What exists:
- Configurable condition catalog; `assets.condition` stores the text key.

Relevant files:
- `src/modules/conditions/actions.ts`

Relevant routes:
- `/dashboard/administration/conditions`

Database tables:
- `asset_conditions`, `assets.condition`

Permissions:
- `statuses.*`

Notes:
- None.

### Feature: Asset type
Status: PARTIALLY_COMPLETED

What exists:
- Categories fill the “type” role. No separate asset-type entity.

Relevant files:
- `src/modules/categories/types.ts`

Relevant routes:
- `/dashboard/administration/categories`

Database tables:
- `asset_categories`

Permissions:
- `categories.*`

Notes:
- Grouped under categories.

### Feature: Brand
Status: COMPLETED

What exists:
- `assets.brand` on create/edit form.

Relevant files:
- `src/modules/assets/types.ts`

Relevant routes:
- `/assets/new`, `/assets/[id]`

Database tables:
- `assets.brand`

Permissions:
- `assets.create/edit`

Notes:
- None.

### Feature: Model
Status: COMPLETED

What exists:
- `assets.model` on form.

Relevant files:
- `src/modules/assets/types.ts`

Relevant routes:
- `/assets/new`, `/assets/[id]`

Database tables:
- `assets.model`

Permissions:
- `assets.create/edit`

Notes:
- None.

### Feature: Serial number
Status: COMPLETED

What exists:
- `assets.serial_number` on form and public tag.

Relevant files:
- `src/modules/assets/types.ts`

Relevant routes:
- `/assets/[id]`, `/tag/[id]`

Database tables:
- `assets.serial_number`

Permissions:
- `assets.create/edit`

Notes:
- No unique constraint on serial.

### Feature: Description
Status: COMPLETED

What exists:
- `assets.description` on form and public tag.

Relevant files:
- `src/modules/assets/types.ts`

Relevant routes:
- `/assets/[id]`, `/tag/[id]`

Database tables:
- `assets.description`

Permissions:
- `assets.create/edit`

Notes:
- None.

### Feature: Asset images
Status: COMPLETED

What exists:
- Single `image_url` upload field.

Relevant files:
- `src/components/assets/image-upload-field.tsx`

Relevant routes:
- `/assets/new`, `/assets/[id]`

Database tables:
- `assets.image_url`

Permissions:
- `assets.create/edit`

Notes:
- None.

### Feature: Multiple images
Status: PARTIALLY_COMPLETED

What exists:
- Extra photos can be stored as `asset_documents` with type `photo`. Primary image is one field.

Relevant files:
- `src/components/assets/attachment-uploader.tsx`

Relevant routes:
- `/assets/[id]`

Database tables:
- `asset_documents`

Permissions:
- `assets.edit`

Notes:
- No gallery UI.

### Feature: Attachments
Status: COMPLETED

What exists:
- Upload to R2, metadata in `asset_documents`, type + expiry fields, list on detail.

Relevant files:
- `src/modules/assets/actions.ts` (`uploadAssetAttachmentAction`)
- `src/components/assets/attachment-uploader.tsx`

Relevant routes:
- `/assets/[id]`

Database tables:
- `asset_documents`, `document_types`

Permissions:
- `assets.edit`

Notes:
- Server-side MIME allow-list and size check in storage module.

### Feature: Custom fields
Status: COMPLETED

What exists:
- Per-category fields: text, number, date, select, checkbox, textarea, email, url, phone. Values in `assets.custom_fields` jsonb.

Relevant files:
- `src/modules/categories/actions.ts`
- `src/app/(dashboard)/dashboard/administration/fields/page.tsx`

Relevant routes:
- `/dashboard/administration/fields`

Database tables:
- `category_fields`, `assets.custom_fields`

Permissions:
- `categories.*`

Notes:
- None.

### Feature: Tags
Status: NOT_FOUND

What exists:
- No tags table or freeform asset tags. Marketing copy refers to QR tags.

Relevant files:
- None (product tags)

Relevant routes:
- None

Database tables:
- None

Permissions:
- N/A

Notes:
- Do not confuse with `/tag/[id]` QR pages.

### Feature: Department
Status: NOT_FOUND

What exists:
- No departments table. Locations and users only.

Relevant files:
- None

Relevant routes:
- None

Database tables:
- None

Permissions:
- N/A

Notes:
- None.

### Feature: Location
Status: COMPLETED

What exists:
- Hierarchy assignment on the asset form. List filter includes descendants.

Relevant files:
- `src/modules/assets/actions.ts`
- `src/modules/locations/queries.ts` (`listLocationAndDescendantIds`)

Relevant routes:
- `/assets`, `/assets/[id]`

Database tables:
- `assets.location_id`, `locations`

Permissions:
- `assets.edit`, `locations.view`

Notes:
- None.

### Feature: Custodian
Status: COMPLETED

What exists:
- `assets.allotted_to` user FK, allotment date, live pointer plus handover history.

Relevant files:
- `src/modules/assets/types.ts`
- `src/modules/custody/actions.ts`

Relevant routes:
- `/assets/[id]`

Database tables:
- `assets.allotted_to`, `asset_handovers`

Permissions:
- `assets.edit` for form field; `handover.assign` for handover actions

Notes:
- Custodian is a company user, not a separate employee table.

### Feature: Employee assignment
Status: COMPLETED

What exists:
- Same as custodian: assign to `users`. Handover flow is the structured assignment.

Relevant files:
- `src/modules/custody/actions.ts`

Relevant routes:
- `/assets/[id]`

Database tables:
- `users`, `assets.allotted_to`

Permissions:
- `handover.assign`

Notes:
- No HR/employee master data beyond `users`.

### Feature: Vendor (on asset)
Status: PARTIALLY_COMPLETED

What exists:
- Free-text `assets.vendor` on purchase info. Separate FK `assets.vendor_id` for vendor-module RLS. Form still uses the text field; vendor records are a different module.

Relevant files:
- `src/modules/assets/types.ts`
- `supabase/migrations/0017_assets_field_redesign.sql`
- `supabase/migrations/0038_vendors_pm.sql`

Relevant routes:
- `/assets/[id]`, `/dashboard/administration/vendors`

Database tables:
- `assets.vendor`, `assets.vendor_id`, `vendors`

Permissions:
- `assets.edit`, `vendors.*`

Notes:
- Text vendor and vendor FK are not the same field.

### Feature: Purchase information
Status: COMPLETED

What exists:
- PO number, purchase date, purchase price, ownership type, partner name.

Relevant files:
- `src/modules/assets/types.ts`

Relevant routes:
- `/assets/[id]`

Database tables:
- `assets.po_number`, `purchase_date`, `purchase_price`, `ownership_type`, `partner_name`

Permissions:
- `assets.create/edit`

Notes:
- Depreciation columns were dropped in 0017.

### Feature: Invoice information
Status: COMPLETED

What exists:
- Invoice date, invoice number, CWIP invoice id.

Relevant files:
- `src/modules/assets/types.ts`

Relevant routes:
- `/assets/[id]`

Database tables:
- `assets.invoice_date`, `invoice_number`, `cwip_invoice_id`

Permissions:
- `assets.create/edit`

Notes:
- None.

### Feature: Warranty
Status: COMPLETED

What exists:
- Start/end dates on asset. Reminder emails via notification rules.

Relevant files:
- `src/modules/email/scheduler.ts`

Relevant routes:
- `/assets/[id]`, `/dashboard/administration/notifications`

Database tables:
- `assets.warranty_start_date`, `warranty_end_date`

Permissions:
- `assets.edit`

Notes:
- None.

### Feature: AMC
Status: COMPLETED

What exists:
- Provider + start/end on asset. Reminder emails. Not a separate AMC contract entity.

Relevant files:
- `src/modules/assets/types.ts`
- `src/modules/email/scheduler.ts`

Relevant routes:
- `/assets/[id]`

Database tables:
- `assets.amc_provider`, `amc_start_date`, `amc_end_date`

Permissions:
- `assets.edit`

Notes:
- None.

### Feature: Insurance
Status: COMPLETED

What exists:
- Provider, policy number, expiry. Reminder emails.

Relevant files:
- `src/modules/assets/types.ts`

Relevant routes:
- `/assets/[id]`

Database tables:
- `assets.insurance_provider`, `insurance_policy_number`, `insurance_expiry_date`

Permissions:
- `assets.edit`

Notes:
- None.

### Feature: Asset value
Status: COMPLETED

What exists:
- `purchase_price` numeric(12,2).

Relevant files:
- `src/modules/assets/types.ts`

Relevant routes:
- `/assets/[id]`

Database tables:
- `assets.purchase_price`

Permissions:
- `assets.create/edit`

Notes:
- Hidden on public tag page.

### Feature: Parent asset
Status: PARTIALLY_COMPLETED

What exists:
- Single `linked_asset_id` (related/linked), not a parent/child tree.

Relevant files:
- `src/modules/assets/types.ts`

Relevant routes:
- `/assets/[id]`

Database tables:
- `assets.linked_asset_id`

Permissions:
- `assets.edit`

Notes:
- Grouped under related assets.

### Feature: Related assets
Status: PARTIALLY_COMPLETED

What exists:
- One linked asset picker. No many-to-many related set.

Relevant files:
- `src/modules/assets/actions.ts` (`getAssetFormOptionsForForm`)

Relevant routes:
- `/assets/[id]`

Database tables:
- `assets.linked_asset_id`

Permissions:
- `assets.edit`

Notes:
- None.

### Feature: Accessories
Status: PARTIALLY_COMPLETED

What exists:
- Free-text accessories on handover; missing accessories on return. No accessory asset register.

Relevant files:
- `src/modules/custody/types.ts`
- `supabase/migrations/0037_custody.sql`

Relevant routes:
- `/assets/[id]`

Database tables:
- `asset_handovers.accessories`, `asset_returns.missing_accessories`

Permissions:
- `handover.assign`

Notes:
- None.

### Feature: Asset history
Status: COMPLETED

What exists:
- Location history table. Lifecycle events for handover/return/transfer/dispose.

Relevant files:
- `src/modules/assets/queries.ts` (`listAssetLocationHistory`)
- `src/modules/custody/queries.ts`

Relevant routes:
- `/assets/[id]`

Database tables:
- `asset_location_history`, `asset_lifecycle_events`

Permissions:
- `assets.view` for location history

Notes:
- None.

### Feature: Asset timeline
Status: COMPLETED

What exists:
- `asset_lifecycle_events` rendered on the asset detail custody panel.

Relevant files:
- `src/modules/custody/actions.ts` (`getLifecycleEventsForAsset`)

Relevant routes:
- `/assets/[id]`

Database tables:
- `asset_lifecycle_events`

Permissions:
- Handover module for write; read on detail page

Notes:
- None.

### Feature: Asset activity logs
Status: PARTIALLY_COMPLETED

What exists:
- Lifecycle events + location history. Company `audit_log` does not record asset create/update/delete.

Relevant files:
- `src/lib/audit-log.ts`

Relevant routes:
- `/dashboard/administration/activity`

Database tables:
- `audit_log`, `asset_lifecycle_events`

Permissions:
- `settings.view` for activity page

Notes:
- None.

### Feature: Asset search
Status: NOT_FOUND

What exists:
- No name/code search box. Filters only.

Relevant files:
- `src/app/(dashboard)/assets/asset-filters.tsx`

Relevant routes:
- `/assets`

Database tables:
- N/A

Permissions:
- N/A

Notes:
- None.

### Feature: Asset filters
Status: COMPLETED

What exists:
- Category, location (with descendants), status. Query params validated with Zod.

Relevant files:
- `src/modules/assets/actions.ts` (`getAssetsForList`)

Relevant routes:
- `/assets`

Database tables:
- `assets`

Permissions:
- RLS

Notes:
- No custodian/vendor/condition filters on the list.

### Feature: Asset sorting
Status: PARTIALLY_COMPLETED

What exists:
- Fixed `created_at desc`. No user-controlled sort.

Relevant files:
- `src/modules/assets/queries.ts` (`listAssets`)

Relevant routes:
- `/assets`

Database tables:
- `assets.created_at`

Permissions:
- N/A

Notes:
- None.

### Feature: Pagination
Status: COMPLETED

What exists:
- Page size 25, `count: exact`, page links preserve filters.

Relevant files:
- `src/app/(dashboard)/assets/page.tsx`

Relevant routes:
- `/assets`

Database tables:
- `assets`

Permissions:
- N/A

Notes:
- None.

### Feature: Bulk actions
Status: NOT_FOUND

What exists:
- No multi-select on the asset list. Bulk exists only as CSV import of new assets.

Relevant files:
- `src/modules/reports/actions.ts` (`commitImportAction`)

Relevant routes:
- `/dashboard/administration/reports`

Database tables:
- `import_jobs`

Permissions:
- `assets.create` + `reports` module

Notes:
- None.

---

## 4. QR and Barcode Management

### Feature: QR code generation
Status: COMPLETED

What exists:
- Client SVG via `qrcode` library encoding `/tag/{assetId}`. Persist `qr_generated_at`.

Relevant files:
- `src/components/assets/qr-tag.tsx`
- `src/modules/assets/actions.ts` (`markQrGeneratedAction`)

Relevant routes:
- `/assets/[id]`

Database tables:
- `assets.qr_generated_at`

Permissions:
- `assets.view` to mark generated

Notes:
- Generation is client-side; server only stores the timestamp.

### Feature: QR code download
Status: COMPLETED

What exists:
- Download SVG named `{assetCode}-qr.svg`. Copy URL.

Relevant files:
- `src/components/assets/qr-tag.tsx`

Relevant routes:
- `/assets/[id]`

Database tables:
- None extra

Permissions:
- UI on asset detail

Notes:
- None.

### Feature: QR code printing
Status: PARTIALLY_COMPLETED

What exists:
- Marketing mentions print. Component has generate/download/copy/regenerate. No print stylesheet or print dialog.

Relevant files:
- `src/components/assets/qr-tag.tsx`

Relevant routes:
- `/assets/[id]`

Database tables:
- None

Permissions:
- N/A

Notes:
- User can print the SVG after download.

### Feature: Bulk QR generation
Status: NOT_FOUND

What exists:
- Per-asset only.

Relevant files:
- None

Relevant routes:
- None

Database tables:
- None

Permissions:
- N/A

Notes:
- None.

### Feature: Public QR page
Status: COMPLETED

What exists:
- `/tag/[id]` loads identification fields via service-role, no financials. Company branding. Anonymous allowed.

Relevant files:
- `src/app/tag/[id]/page.tsx`
- `src/modules/assets/queries.ts` (`getPublicAssetById`)

Relevant routes:
- `/tag/[id]`

Database tables:
- `assets` (subset of columns)

Permissions:
- Public read of non-financial fields

Notes:
- UUID in URL is the access control.

### Feature: Private QR page
Status: PARTIALLY_COMPLETED

What exists:
- Signed-in members with `assets.view` get “Open in TagX”. Others get floor-audit or dashboard links. Super admin stays read-only on the tag.

Relevant files:
- `src/modules/assets/actions.ts` (`getTagPageViewer`)

Relevant routes:
- `/tag/[id]`, `/assets/[id]`

Database tables:
- N/A

Permissions:
- `assets.view` for private record

Notes:
- Same URL; behavior changes with session.

### Feature: QR asset lookup
Status: COMPLETED

What exists:
- Tag page lookup by asset id. Audit scan lookup by id or code.

Relevant files:
- `src/modules/audits/actions.ts` (`lookupAuditScanAction`)

Relevant routes:
- `/tag/[id]`, `/floor/audits/[id]`

Database tables:
- `assets`, `audit_items`

Permissions:
- Public for tag; `audits.edit` for scan lookup

Notes:
- None.

### Feature: QR issue reporting
Status: COMPLETED

What exists:
- Public form creates a maintenance ticket (`createPublicTicket`) with rate limit on recent reports.

Relevant files:
- `src/app/tag/[id]/report-form.tsx`
- `src/modules/assets/actions.ts` (`submitPublicAssetReportAction`)

Relevant routes:
- `/tag/[id]`

Database tables:
- `maintenance_tickets`

Permissions:
- Public, throttled

Notes:
- None.

### Feature: QR scan history
Status: PARTIALLY_COMPLETED

What exists:
- `audit_items.scanned_at` / `scanned_by` per campaign. No global scan log outside audits.

Relevant files:
- `supabase/migrations/0029_physical_audits.sql`

Relevant routes:
- `/dashboard/administration/audits/[id]`

Database tables:
- `audit_items`

Permissions:
- `audits.view`

Notes:
- None.

### Feature: QR audit scanning
Status: COMPLETED

What exists:
- Floor camera scanner (`BarcodeDetector` when available), manual code entry, tag-page verify form during active audits.

Relevant files:
- `src/components/audits/qr-camera-scanner.tsx`
- `src/components/audits/audit-scan-form.tsx`
- `src/app/tag/[id]/audit-verify-form.tsx`

Relevant routes:
- `/floor/audits/[id]`, `/tag/[id]`

Database tables:
- `audit_items`

Permissions:
- `audits.edit`

Notes:
- Camera path uses the browser Barcode Detection API, not a separate barcode symbology module.

### Feature: QR security
Status: PARTIALLY_COMPLETED

What exists:
- Public page omits purchase/financial fields. IDs are UUIDs.

Relevant files:
- `src/modules/assets/types.ts` (`PublicAsset`)

Relevant routes:
- `/tag/[id]`

Database tables:
- N/A

Permissions:
- Column subset only

Notes:
- Anyone with the UUID can view identification data. No signed/expiring QR tokens.

### Feature: QR replacement
Status: PARTIALLY_COMPLETED

What exists:
- Regenerate button re-renders the same `/tag/{id}` URL and can refresh `qr_generated_at`. URL does not change, so old stickers still work.

Relevant files:
- `src/components/assets/qr-tag.tsx`

Relevant routes:
- `/assets/[id]`

Database tables:
- `assets.qr_generated_at`

Permissions:
- `assets.view`

Notes:
- Replacement does not invalidate previous labels.

### Feature: Barcode support
Status: PARTIALLY_COMPLETED

What exists:
- Floor scanner uses `window.BarcodeDetector` to read camera input (often QR). No Code128/EAN generation or barcode field on assets.

Relevant files:
- `src/components/audits/qr-camera-scanner.tsx`

Relevant routes:
- `/floor/audits/[id]`

Database tables:
- None

Permissions:
- `audits.edit`

Notes:
- Not a barcode labeling product.

### Feature: NFC/RFID fields
Status: NOT_FOUND

What exists:
- No NFC/RFID columns or UI.

Relevant files:
- None

Relevant routes:
- None

Database tables:
- None

Permissions:
- N/A

Notes:
- None.

---

## 5. Location Management

### Feature: Sites
Status: COMPLETED

What exists:
- Location kind `site` is the root of the hierarchy.

Relevant files:
- `src/modules/locations/types.ts`

Relevant routes:
- `/dashboard/administration/locations`

Database tables:
- `locations.kind`

Permissions:
- `locations.*`

Notes:
- None.

### Feature: Buildings
Status: COMPLETED

What exists:
- Kind `building` must nest under `site`.

Relevant files:
- `src/modules/locations/types.ts` (`LOCATION_KIND_PARENT`)

Relevant routes:
- `/dashboard/administration/locations`

Database tables:
- `locations`

Permissions:
- `locations.*`

Notes:
- None.

### Feature: Floors
Status: COMPLETED

What exists:
- Kind `floor` under `building`.

Relevant files:
- `src/modules/locations/types.ts`

Relevant routes:
- `/dashboard/administration/locations`

Database tables:
- `locations`

Permissions:
- `locations.*`

Notes:
- Distinct from the `/floor` audit UI route.

### Feature: Rooms
Status: COMPLETED

What exists:
- Kind `room` labeled “Room / Zone”, under `floor`.

Relevant files:
- `src/modules/locations/types.ts`

Relevant routes:
- `/dashboard/administration/locations`

Database tables:
- `locations`

Permissions:
- `locations.*`

Notes:
- None.

### Feature: Zones
Status: PARTIALLY_COMPLETED

What exists:
- Zones share the `room` kind label. No separate zone entity.

Relevant files:
- `src/modules/locations/types.ts`

Relevant routes:
- `/dashboard/administration/locations`

Database tables:
- `locations`

Permissions:
- `locations.*`

Notes:
- Grouped with rooms.

### Feature: Location hierarchy
Status: COMPLETED

What exists:
- Parent FK, path/depth computed in queries, address fields, child count. Kind parent rules enforced in validation.

Relevant files:
- `src/modules/locations/actions.ts`
- `supabase/migrations/0031_location_hierarchy.sql`

Relevant routes:
- `/dashboard/administration/locations`

Database tables:
- `locations.parent_location_id`

Permissions:
- `locations.*`

Notes:
- None.

### Feature: Location creation
Status: COMPLETED

What exists:
- Create action with Zod validation.

Relevant files:
- `src/modules/locations/actions.ts` (`createLocationAction`)

Relevant routes:
- `/dashboard/administration/locations`

Database tables:
- `locations`

Permissions:
- `locations.create`

Notes:
- None.

### Feature: Location editing
Status: COMPLETED

What exists:
- Update name/kind/parent/address.

Relevant files:
- `src/modules/locations/actions.ts` (`updateLocationAction`)

Relevant routes:
- `/dashboard/administration/locations`

Database tables:
- `locations`

Permissions:
- `locations.edit`

Notes:
- None.

### Feature: Location deletion
Status: COMPLETED

What exists:
- Delete action. Assets reference `ON DELETE SET NULL`.

Relevant files:
- `src/modules/locations/actions.ts` (`deleteLocationAction`)

Relevant routes:
- `/dashboard/administration/locations`

Database tables:
- `locations`

Permissions:
- `locations.delete`

Notes:
- Child-location constraints depend on DB/app validation (`NOT_VERIFIED` for cascade of children).

### Feature: Asset location assignment
Status: COMPLETED

What exists:
- Asset form location picker; history row on change.

Relevant files:
- `src/modules/assets/mutations.ts` (`recordAssetLocationMove`)

Relevant routes:
- `/assets/[id]`

Database tables:
- `assets.location_id`, `asset_location_history`

Permissions:
- `assets.edit`

Notes:
- None.

### Feature: Location history
Status: COMPLETED

What exists:
- `asset_location_history` listed on asset detail.

Relevant files:
- `src/modules/assets/queries.ts`

Relevant routes:
- `/assets/[id]`

Database tables:
- `asset_location_history`

Permissions:
- `assets.view`

Notes:
- History is per asset, not a location-centric ledger page.

### Feature: Location filters
Status: COMPLETED

What exists:
- Asset list location filter includes descendant ids.

Relevant files:
- `src/modules/locations/queries.ts`

Relevant routes:
- `/assets`

Database tables:
- `locations`, `assets`

Permissions:
- N/A

Notes:
- None.

### Feature: Location-wise reports
Status: COMPLETED

What exists:
- Report key `by_location` CSV/Excel-xml export.

Relevant files:
- `src/modules/reports/types.ts`
- `src/modules/reports/queries.ts`

Relevant routes:
- `/dashboard/administration/reports`

Database tables:
- `assets`, `locations`

Permissions:
- `reports.export` + reports module

Notes:
- No interactive location report page beyond export.

---

## 6. Asset Assignment and Custody

### Feature: Asset assignment
Status: COMPLETED

What exists:
- Form field `allotted_to` plus structured handover action that updates the live pointer and writes history.

Relevant files:
- `src/modules/custody/actions.ts` (`handoverAssetAction`)

Relevant routes:
- `/assets/[id]`

Database tables:
- `assets.allotted_to`, `asset_handovers`, `asset_lifecycle_events`

Permissions:
- `handover.assign` + handover module

Notes:
- Email `asset_assigned` dispatched.

### Feature: Employee assignment
Status: COMPLETED

What exists:
- Assign to company `users`.

Relevant files:
- `src/modules/custody/actions.ts`

Relevant routes:
- `/assets/[id]`

Database tables:
- `users`

Permissions:
- `handover.assign`

Notes:
- Same as custodian.

### Feature: Department assignment
Status: NOT_FOUND

What exists:
- No department entity.

Relevant files:
- None

Relevant routes:
- None

Database tables:
- None

Permissions:
- N/A

Notes:
- None.

### Feature: Location assignment
Status: COMPLETED

What exists:
- Asset location field and transfer action with from/to location.

Relevant files:
- `src/modules/custody/actions.ts` (`transferAssetAction`)

Relevant routes:
- `/assets/[id]`

Database tables:
- `asset_transfers`, `assets.location_id`

Permissions:
- `handover.assign`

Notes:
- None.

### Feature: Custodian assignment
Status: COMPLETED

What exists:
- See Asset assignment.

Relevant files:
- `src/modules/custody/actions.ts`

Relevant routes:
- `/assets/[id]`

Database tables:
- `assets.allotted_to`

Permissions:
- `handover.assign`

Notes:
- None.

### Feature: Asset transfer
Status: COMPLETED

What exists:
- Transfer user and/or location, reason, date, lifecycle event, email.

Relevant files:
- `src/modules/custody/actions.ts` (`transferAssetAction`)

Relevant routes:
- `/assets/[id]`

Database tables:
- `asset_transfers`

Permissions:
- `handover.assign`

Notes:
- `acknowledged_at` column exists; transfer action does not implement a separate ack step like handover.

### Feature: Asset handover
Status: COMPLETED

What exists:
- From/to user, date, accessories, notes.

Relevant files:
- `src/modules/custody/mutations.ts`

Relevant routes:
- `/assets/[id]`

Database tables:
- `asset_handovers`

Permissions:
- `handover.assign`

Notes:
- None.

### Feature: Asset return
Status: COMPLETED

What exists:
- Return date, condition, damage remarks, missing accessories, inspection result; clears allotment.

Relevant files:
- `src/modules/custody/actions.ts` (`returnAssetAction`)

Relevant routes:
- `/assets/[id]`

Database tables:
- `asset_returns`

Permissions:
- `handover.assign`

Notes:
- `approved_by` column exists; action can set it from current user rather than a multi-level workflow.

### Feature: Assignment history
Status: COMPLETED

What exists:
- Handover/return/transfer rows plus lifecycle timeline.

Relevant files:
- `src/modules/custody/queries.ts`

Relevant routes:
- `/assets/[id]`

Database tables:
- `asset_handovers`, `asset_returns`, `asset_transfers`, `asset_lifecycle_events`

Permissions:
- Read on asset detail

Notes:
- No standalone assignment-history report besides `by_custodian` export.

### Feature: Custody history
Status: COMPLETED

What exists:
- Same tables as assignment history.

Relevant files:
- `src/modules/custody/queries.ts`

Relevant routes:
- `/assets/[id]`

Database tables:
- custody tables

Permissions:
- handover module for writes

Notes:
- None.

### Feature: Handover acknowledgement
Status: COMPLETED

What exists:
- `acknowledgeHandoverAction` for pending `acknowledged_at is null`.

Relevant files:
- `src/modules/custody/actions.ts`

Relevant routes:
- `/assets/[id]`

Database tables:
- `asset_handovers.acknowledged_at`, `acknowledged_by`

Permissions:
- Requires handover module; acknowledgement is available on the asset panel

Notes:
- No email-link acknowledgement; in-app only.

### Feature: Return confirmation
Status: PARTIALLY_COMPLETED

What exists:
- Return writes a record and inspection fields. No separate confirmer workflow or dual sign-off UI.

Relevant files:
- `src/modules/custody/actions.ts`

Relevant routes:
- `/assets/[id]`

Database tables:
- `asset_returns.approved_by`

Permissions:
- `handover.assign`

Notes:
- None.

### Feature: Expected return date
Status: NOT_FOUND

What exists:
- No expected-return column on assets or handovers.

Relevant files:
- None

Relevant routes:
- None

Database tables:
- None

Permissions:
- N/A

Notes:
- Maintenance tickets have `due_at`, which is unrelated.

### Feature: Overdue return tracking
Status: NOT_FOUND

What exists:
- No overdue-return query or reminder. Overdue maintenance report is separate.

Relevant files:
- None

Relevant routes:
- None

Database tables:
- None

Permissions:
- N/A

Notes:
- None.

### Feature: Bulk assignment
Status: NOT_FOUND

What exists:
- One asset at a time.

Relevant files:
- None

Relevant routes:
- None

Database tables:
- None

Permissions:
- N/A

Notes:
- None.

### Feature: Accessory assignment
Status: PARTIALLY_COMPLETED

What exists:
- Accessories text on handover only.

Relevant files:
- `src/modules/custody/validation.ts`

Relevant routes:
- `/assets/[id]`

Database tables:
- `asset_handovers.accessories`

Permissions:
- `handover.assign`

Notes:
- None.

---

## 7. Maintenance

### Feature: Maintenance ticket creation
Status: COMPLETED

What exists:
- Admin form: asset, title, description, priority, vendor, due, type. Public QR report also creates tickets. Email `maintenance_created`.

Relevant files:
- `src/modules/maintenance/actions.ts` (`createTicketAction`)

Relevant routes:
- `/dashboard/administration/maintenance`

Database tables:
- `maintenance_tickets`

Permissions:
- `maintenance.create` + maintenance module

Notes:
- None.

### Feature: Ticket editing
Status: PARTIALLY_COMPLETED

What exists:
- `updateTicketAction` updates status and assignee only (not title/description/priority/vendor/due).

Relevant files:
- `src/modules/maintenance/actions.ts`
- `src/modules/maintenance/validation.ts` (`updateTicketSchema`)

Relevant routes:
- `/dashboard/administration/maintenance`

Database tables:
- `maintenance_tickets.status`, `assigned_to`

Permissions:
- `maintenance.edit`

Notes:
- None.

### Feature: Ticket deletion
Status: NOT_FOUND

What exists:
- No delete ticket action. Status includes `cancelled`.

Relevant files:
- None

Relevant routes:
- None

Database tables:
- `maintenance_tickets.status`

Permissions:
- N/A

Notes:
- None.

### Feature: Ticket assignment
Status: COMPLETED

What exists:
- Assign to a company user on create and update.

Relevant files:
- `src/modules/maintenance/actions.ts`

Relevant routes:
- `/dashboard/administration/maintenance`

Database tables:
- `maintenance_tickets.assigned_to`

Permissions:
- `maintenance.edit`

Notes:
- Email `maintenance_assigned` on create when assigned.

### Feature: Technician assignment
Status: PARTIALLY_COMPLETED

What exists:
- Assignee is any company user. No technician role or skill matrix.

Relevant files:
- `src/modules/maintenance/types.ts`

Relevant routes:
- `/dashboard/administration/maintenance`

Database tables:
- `users`

Permissions:
- `maintenance.edit`

Notes:
- Grouped with ticket assignment.

### Feature: Vendor assignment
Status: COMPLETED

What exists:
- `vendor_id` on tickets; vendor users only see those tickets via RLS.

Relevant files:
- `src/modules/maintenance/actions.ts`
- `supabase/migrations/0038_vendors_pm.sql`

Relevant routes:
- `/dashboard/administration/maintenance`

Database tables:
- `maintenance_tickets.vendor_id`

Permissions:
- `maintenance.create/edit`; vendor role limited

Notes:
- Email `vendor_assigned`.

### Feature: Ticket priority
Status: COMPLETED

What exists:
- `low`, `normal`, `high`, `emergency` on create.

Relevant files:
- `src/modules/maintenance/types.ts`

Relevant routes:
- `/dashboard/administration/maintenance`

Database tables:
- `maintenance_tickets.priority`

Permissions:
- `maintenance.create`

Notes:
- Not editable after create via update action.

### Feature: Ticket status
Status: COMPLETED

What exists:
- `open`, `in_progress`, `resolved`, `cancelled`.

Relevant files:
- `src/modules/maintenance/types.ts`

Relevant routes:
- `/dashboard/administration/maintenance`

Database tables:
- `maintenance_tickets.status`

Permissions:
- `maintenance.edit`

Notes:
- None.

### Feature: Ticket comments
Status: NOT_FOUND

What exists:
- Description field only. No comments table.

Relevant files:
- None

Relevant routes:
- None

Database tables:
- None

Permissions:
- N/A

Notes:
- None.

### Feature: Ticket attachments
Status: NOT_FOUND

What exists:
- Asset attachments exist; tickets have no file relation.

Relevant files:
- None

Relevant routes:
- None

Database tables:
- None

Permissions:
- N/A

Notes:
- None.

### Feature: Maintenance history
Status: PARTIALLY_COMPLETED

What exists:
- Ticket list with opened/resolved timestamps. No per-asset maintenance history page beyond listing tickets.

Relevant files:
- `src/modules/maintenance/queries.ts`

Relevant routes:
- `/dashboard/administration/maintenance`

Database tables:
- `maintenance_tickets`

Permissions:
- `maintenance.view`

Notes:
- Dashboard chart of open tickets.

### Feature: Preventive maintenance
Status: COMPLETED

What exists:
- Plans generate tickets when due via cron `generateDuePlanTickets`.

Relevant files:
- `src/modules/maintenance/scheduler.ts`
- `src/app/api/cron/notifications/route.ts`

Relevant routes:
- `/dashboard/administration/maintenance/plans`
- `/api/cron/notifications`

Database tables:
- `maintenance_plans`, `maintenance_tickets.plan_id`

Permissions:
- `maintenance.create` + `preventive_maintenance` module

Notes:
- Cron `Promise.all` runs ticket generation in parallel with reminder emails (race possible same day).

### Feature: Maintenance plans
Status: COMPLETED

What exists:
- Name, asset, frequency/interval, next due, assignee, vendor, active flag.

Relevant files:
- `src/modules/maintenance/actions.ts` (`createPlanAction`)

Relevant routes:
- `/dashboard/administration/maintenance/plans`

Database tables:
- `maintenance_plans`

Permissions:
- `maintenance.create` + PM module

Notes:
- Update/delete plan actions not found; create + list.

### Feature: Recurring maintenance
Status: COMPLETED

What exists:
- Scheduler advances `next_due_at` after creating a ticket.

Relevant files:
- `src/modules/maintenance/scheduler.ts`

Relevant routes:
- Cron

Database tables:
- `maintenance_plans.next_due_at`

Permissions:
- Service role / cron

Notes:
- None.

### Feature: Maintenance reminders
Status: COMPLETED

What exists:
- Email rules `maintenance_due` at 7/1/0 days. Older storage-threshold path also had stale-ticket emails.

Relevant files:
- `src/modules/email/scheduler.ts`
- `src/modules/email/actions.ts` (`sendUpcomingMaintenanceReminderEmails`)

Relevant routes:
- `/dashboard/administration/notifications`

Database tables:
- `notification_rules`, `notification_logs`

Permissions:
- Cron + `notifications.view`

Notes:
- None.

### Feature: Maintenance costs
Status: NOT_FOUND

What exists:
- No cost/labor/parts columns on tickets.

Relevant files:
- None

Relevant routes:
- None

Database tables:
- None

Permissions:
- N/A

Notes:
- None.

### Feature: Maintenance reports
Status: COMPLETED

What exists:
- `maintenance_overdue` standard export and dashboard tile.

Relevant files:
- `src/modules/reports/queries.ts`

Relevant routes:
- `/dashboard/administration/reports`

Database tables:
- `maintenance_tickets`

Permissions:
- `reports.export`

Notes:
- None.

### Feature: SLA tracking
Status: NOT_FOUND

What exists:
- `due_at` exists but no SLA definitions, clocks, or breach states.

Relevant files:
- None

Relevant routes:
- None

Database tables:
- `maintenance_tickets.due_at`

Permissions:
- N/A

Notes:
- None.

### Feature: Escalation
Status: NOT_FOUND

What exists:
- No escalation policies or notifications.

Relevant files:
- None

Relevant routes:
- None

Database tables:
- None

Permissions:
- N/A

Notes:
- None.

### Feature: Ticket reopening
Status: NOT_FOUND

What exists:
- Status can be changed to `open` if the update UI allows selecting it — update schema should be checked. No dedicated reopen action or history of reopen.

Relevant files:
- `src/modules/maintenance/validation.ts`

Relevant routes:
- `/dashboard/administration/maintenance`

Database tables:
- `maintenance_tickets.status`

Permissions:
- `maintenance.edit`

Notes:
- Marked NOT_FOUND as a first-class reopen workflow. Status change may still set `open` depending on UI options.

---

## 8. Audit Management

### Feature: Audit campaign creation
Status: COMPLETED

What exists:
- Name, scheduled date, optional location scope, snapshot of in-scope assets into `audit_items`.

Relevant files:
- `src/modules/audits/actions.ts` (`createAuditAction`)

Relevant routes:
- `/dashboard/administration/audits`

Database tables:
- `audits`, `audit_items`

Permissions:
- `audits.create` + audits module (nav)

Notes:
- `requireModule("audits")` is not called inside createAuditAction (nav gated only).

### Feature: Audit scheduling
Status: COMPLETED

What exists:
- `scheduled_date` on create. Status starts `draft`.

Relevant files:
- `src/modules/audits/types.ts`

Relevant routes:
- `/dashboard/administration/audits`

Database tables:
- `audits.scheduled_date`

Permissions:
- `audits.create`

Notes:
- No calendar integration or reminder emails for audit start.

### Feature: Audit assignment
Status: NOT_FOUND

What exists:
- `created_by` only. No auditor assignment table.

Relevant files:
- None

Relevant routes:
- `/floor/audits` lists active audits for anyone with `audits.view`

Database tables:
- `audits.created_by`

Permissions:
- `audits.view/edit`

Notes:
- Any permitted user can scan.

### Feature: Audit scope
Status: PARTIALLY_COMPLETED

What exists:
- Location (including descendants) or entire company if location empty.

Relevant files:
- `src/modules/audits/actions.ts` (`listAssetsForAuditScope`)

Relevant routes:
- `/dashboard/administration/audits`

Database tables:
- `audit_items` snapshots

Permissions:
- `audits.create`

Notes:
- No department/category/custodian/selected-asset scopes.

### Feature: Location-based audit
Status: COMPLETED

What exists:
- Optional `location_id` on campaign.

Relevant files:
- `src/modules/audits/actions.ts`

Relevant routes:
- `/dashboard/administration/audits`

Database tables:
- `audits.location_id`

Permissions:
- `audits.create`

Notes:
- None.

### Feature: Department-based audit
Status: NOT_FOUND

What exists:
- No departments.

Relevant files:
- None

Relevant routes:
- None

Database tables:
- None

Permissions:
- N/A

Notes:
- None.

### Feature: Category-based audit
Status: NOT_FOUND

What exists:
- Scope is location or all assets.

Relevant files:
- None

Relevant routes:
- None

Database tables:
- None

Permissions:
- N/A

Notes:
- None.

### Feature: Custodian-based audit
Status: NOT_FOUND

What exists:
- No custodian filter at campaign create.

Relevant files:
- None

Relevant routes:
- None

Database tables:
- None

Permissions:
- N/A

Notes:
- None.

### Feature: Selected asset audit
Status: NOT_FOUND

What exists:
- Cannot pick an arbitrary asset list.

Relevant files:
- None

Relevant routes:
- None

Database tables:
- None

Permissions:
- N/A

Notes:
- None.

### Feature: QR scanning
Status: COMPLETED

What exists:
- Floor + tag verify + lookup.

Relevant files:
- `src/modules/audits/actions.ts` (`recordAuditScanAction`)

Relevant routes:
- `/floor/audits/[id]`, `/tag/[id]`

Database tables:
- `audit_items`

Permissions:
- `audits.edit`

Notes:
- None.

### Feature: Manual verification
Status: COMPLETED

What exists:
- Scan form can record location/condition/notes without camera.

Relevant files:
- `src/components/audits/audit-scan-form.tsx`

Relevant routes:
- `/floor/audits/[id]`, `/dashboard/administration/audits/[id]`

Database tables:
- `audit_items`

Permissions:
- `audits.edit`

Notes:
- None.

### Feature: Found assets
Status: COMPLETED

What exists:
- Item status `verified` when scan matches.

Relevant files:
- `src/modules/audits/mutations.ts`

Relevant routes:
- `/dashboard/administration/audits/[id]`

Database tables:
- `audit_items.status`

Permissions:
- `audits.edit`

Notes:
- None.

### Feature: Missing assets
Status: COMPLETED

What exists:
- `markMissingAction` sets exception type `missing`.

Relevant files:
- `src/modules/audits/actions.ts`

Relevant routes:
- `/dashboard/administration/audits/[id]`

Database tables:
- `audit_items.exception_types`

Permissions:
- `audits.edit`

Notes:
- None.

### Feature: Wrong location
Status: COMPLETED

What exists:
- Auto-evaluated when found location ≠ expected.

Relevant files:
- `src/modules/audits/actions.ts`

Relevant routes:
- Scan flows

Database tables:
- `audit_items`

Permissions:
- `audits.edit`

Notes:
- None.

### Feature: Wrong custodian
Status: PARTIALLY_COMPLETED

What exists:
- Exception type `wrong_custodian` exists in catalog and TypeScript list. Scan evaluation in `recordAuditScanAction` compares location and condition only, not allotted user.

Relevant files:
- `src/modules/audits/types.ts`
- `src/modules/audits/actions.ts`

Relevant routes:
- Audit detail

Database tables:
- `audit_exception_types`, `audit_items.exception_types`

Permissions:
- `audits.edit`

Notes:
- Can be stored if UI sends it; auto-detect not implemented.

### Feature: Damaged assets
Status: PARTIALLY_COMPLETED

What exists:
- Exception `qr_damaged` and condition mismatch. No dedicated “damaged asset” status beyond condition/exceptions.

Relevant files:
- `src/modules/audits/types.ts`

Relevant routes:
- Audit scan

Database tables:
- `audit_items`

Permissions:
- `audits.edit`

Notes:
- None.

### Feature: Audit exceptions
Status: COMPLETED

What exists:
- Types seeded: missing, wrong_location, condition_mismatch, wrong_custodian, qr_damaged, not_registered, duplicate, document_missing. Items use `exception` status + types array. Resolve action exists.

Relevant files:
- `src/modules/audits/actions.ts` (`resolveAuditItemAction`)
- `supabase/migrations/0040_reports_docs.sql`

Relevant routes:
- `/dashboard/administration/audits/[id]`

Database tables:
- `audit_items`, `audit_exception_types`

Permissions:
- `audits.edit`

Notes:
- Exception types table is not exposed as an admin editor; keys are hardcoded in TS.

### Feature: Audit progress
Status: COMPLETED

What exists:
- List shows total/verified/exception counts.

Relevant files:
- `src/modules/audits/types.ts` (`AuditListItem`)

Relevant routes:
- `/dashboard/administration/audits`, `/floor/audits`

Database tables:
- `audit_items`

Permissions:
- `audits.view`

Notes:
- None.

### Feature: Audit photos
Status: PARTIALLY_COMPLETED

What exists:
- `require_photo_on_exception` column and create-form checkbox. Scan action does not upload or require a photo file.

Relevant files:
- `src/modules/audits/actions.ts` (`createAuditAction`)
- `supabase/migrations/0040_reports_docs.sql`

Relevant routes:
- `/dashboard/administration/audits`

Database tables:
- `audits.require_photo_on_exception`

Permissions:
- `audits.create`

Notes:
- Flag is stored but not enforced.

### Feature: Audit remarks
Status: COMPLETED

What exists:
- Notes on scan. `require_remark_on_exception` is enforced when location/condition mismatch.

Relevant files:
- `src/modules/audits/actions.ts`

Relevant routes:
- Scan forms

Database tables:
- `audit_items.notes`, `audits.require_remark_on_exception`

Permissions:
- `audits.edit`

Notes:
- None.

### Feature: Audit approval
Status: NOT_FOUND

What exists:
- Complete is a single `completeAuditAction` by anyone with `audits.edit`. No approver chain.

Relevant files:
- `src/modules/audits/actions.ts`

Relevant routes:
- `/dashboard/administration/audits/[id]`

Database tables:
- `audits.status`

Permissions:
- `audits.edit`

Notes:
- None.

### Feature: Audit closure
Status: COMPLETED

What exists:
- `completeAuditAction` sets `completed` + `completed_at`.

Relevant files:
- `src/modules/audits/actions.ts`

Relevant routes:
- `/dashboard/administration/audits/[id]`

Database tables:
- `audits`

Permissions:
- `audits.edit`

Notes:
- No reopen-completed workflow found.

### Feature: Audit history
Status: COMPLETED

What exists:
- Past campaigns remain listed. Snapshots preserve expected location/condition.

Relevant files:
- `src/modules/audits/queries.ts`

Relevant routes:
- `/dashboard/administration/audits`

Database tables:
- `audits`, `audit_items`

Permissions:
- `audits.view`

Notes:
- None.

### Feature: Audit comparison
Status: NOT_FOUND

What exists:
- No compare-two-campaigns UI.

Relevant files:
- None

Relevant routes:
- None

Database tables:
- None

Permissions:
- N/A

Notes:
- None.

### Feature: Floor audit
Status: COMPLETED

What exists:
- Mobile-oriented `/floor` layout, active audit list, scan page.

Relevant files:
- `src/app/(floor)/floor/layout.tsx`
- `src/app/(floor)/floor/audits/page.tsx`

Relevant routes:
- `/floor`, `/floor/audits`, `/floor/audits/[id]`

Database tables:
- `audits`, `audit_items`

Permissions:
- Session required; `audits.view` for lists

Notes:
- Floor layout does not check `audits` permission before rendering the shell.

### Feature: Audit reports
Status: COMPLETED

What exists:
- `exportAuditResultsAction` and standard report `audit_exceptions`.

Relevant files:
- `src/modules/audits/actions.ts`
- `src/modules/reports/queries.ts`

Relevant routes:
- `/dashboard/administration/audits/[id]`, `/dashboard/administration/reports`

Database tables:
- `audit_items`

Permissions:
- `audits.view` for audit export; `reports.export` for standard report

Notes:
- None.

### Feature: Duplicate scan prevention
Status: PARTIALLY_COMPLETED

What exists:
- Unique `(audit_id, asset_id)` so an asset appears once per campaign. Re-scanning updates the same item. Exception type `duplicate` exists but is not auto-set on second scan.

Relevant files:
- `supabase/migrations/0029_physical_audits.sql`

Relevant routes:
- Scan flows

Database tables:
- `audit_items` unique constraint

Permissions:
- N/A

Notes:
- Second scan overwrites verification rather than rejecting it.

---

## 9. Vendor Management

### Feature: Vendor creation
Status: COMPLETED

What exists:
- Name, company name, contact, email, phone, address, service category, notes, active flag.

Relevant files:
- `src/modules/vendors/actions.ts`

Relevant routes:
- `/dashboard/administration/vendors`

Database tables:
- `vendors`

Permissions:
- `vendors.create` + vendors module

Notes:
- None.

### Feature: Vendor editing
Status: COMPLETED

What exists:
- `updateVendorAction`.

Relevant files:
- `src/modules/vendors/actions.ts`

Relevant routes:
- `/dashboard/administration/vendors`

Database tables:
- `vendors`

Permissions:
- `vendors.edit`

Notes:
- None.

### Feature: Vendor deletion
Status: NOT_FOUND

What exists:
- `is_active` flag only. No delete action.

Relevant files:
- `src/modules/vendors/actions.ts`

Relevant routes:
- `/dashboard/administration/vendors`

Database tables:
- `vendors.is_active`

Permissions:
- `vendors.delete` exists in taxonomy but has no caller.

Notes:
- Permission key unused.

### Feature: Vendor contacts
Status: PARTIALLY_COMPLETED

What exists:
- Single contact name/email/phone on the vendor row. No contacts child table.

Relevant files:
- `src/modules/vendors/types.ts`

Relevant routes:
- `/dashboard/administration/vendors`

Database tables:
- `vendors.contact_name`, `email`, `phone`

Permissions:
- `vendors.edit`

Notes:
- None.

### Feature: Vendor categories
Status: PARTIALLY_COMPLETED

What exists:
- Free-text `service_category` on vendor. No category catalog.

Relevant files:
- `src/modules/vendors/validation.ts`

Relevant routes:
- `/dashboard/administration/vendors`

Database tables:
- `vendors.service_category`

Permissions:
- `vendors.edit`

Notes:
- None.

### Feature: Vendor documents
Status: NOT_FOUND

What exists:
- Documents attach to assets only.

Relevant files:
- None

Relevant routes:
- None

Database tables:
- None

Permissions:
- N/A

Notes:
- None.

### Feature: Vendor assets
Status: PARTIALLY_COMPLETED

What exists:
- `assets.vendor_id` for RLS. No vendor-assets admin page. Purchase vendor is a text field.

Relevant files:
- `supabase/migrations/0038_vendors_pm.sql`

Relevant routes:
- None dedicated

Database tables:
- `assets.vendor_id`

Permissions:
- Vendor role `assets.view` (RLS-filtered)

Notes:
- None.

### Feature: Vendor maintenance tickets
Status: COMPLETED

What exists:
- Tickets can set `vendor_id`. Vendor users see only those tickets.

Relevant files:
- `src/modules/maintenance/actions.ts`

Relevant routes:
- `/dashboard/administration/maintenance`

Database tables:
- `maintenance_tickets.vendor_id`

Permissions:
- Vendor: `maintenance.view/edit`

Notes:
- None.

### Feature: Vendor portal
Status: PARTIALLY_COMPLETED

What exists:
- Vendors log into the same tenant app with a Vendor role. No `/vendor` route group.

Relevant files:
- `src/middleware.ts`
- `supabase/migrations/0038_vendors_pm.sql`

Relevant routes:
- `/{slug}/login` then `/dashboard`

Database tables:
- `users.vendor_id`

Permissions:
- Vendor role map

Notes:
- UX is the staff shell with RLS hiding most assets.

### Feature: Vendor login
Status: COMPLETED

What exists:
- Invite with vendor selected creates `users.vendor_id`. Same password login as staff.

Relevant files:
- `src/modules/users/actions.ts`

Relevant routes:
- `/{slug}/login`, `/invite/[token]`

Database tables:
- `users`, `company_invites.vendor_id`

Permissions:
- Invite: `users.create`

Notes:
- None.

### Feature: Vendor permissions
Status: COMPLETED

What exists:
- Seeded Vendor role + RLS WITH CHECK preventing asset writes.

Relevant files:
- `supabase/migrations/0038_vendors_pm.sql`

Relevant routes:
- N/A

Database tables:
- `roles`, `users.vendor_id`

Permissions:
- `assets.view`, `maintenance.view/edit`

Notes:
- Custom roles could grant more; RLS still blocks asset writes for vendor-scoped users.

### Feature: Vendor contracts
Status: NOT_FOUND

What exists:
- No contracts table.

Relevant files:
- None

Relevant routes:
- None

Database tables:
- None

Permissions:
- N/A

Notes:
- None.

### Feature: AMC records
Status: PARTIALLY_COMPLETED

What exists:
- AMC fields on assets, not vendor-linked AMC records.

Relevant files:
- `src/modules/assets/types.ts`

Relevant routes:
- `/assets/[id]`

Database tables:
- `assets.amc_*`

Permissions:
- `assets.edit`

Notes:
- Grouped under asset register.

### Feature: Warranty records
Status: PARTIALLY_COMPLETED

What exists:
- Warranty dates on assets.

Relevant files:
- `src/modules/assets/types.ts`

Relevant routes:
- `/assets/[id]`

Database tables:
- `assets.warranty_*`

Permissions:
- `assets.edit`

Notes:
- None.

### Feature: Vendor performance
Status: NOT_FOUND

What exists:
- No KPIs or SLA scores.

Relevant files:
- None

Relevant routes:
- None

Database tables:
- None

Permissions:
- N/A

Notes:
- None.

### Feature: Vendor rating
Status: NOT_FOUND

What exists:
- No rating field.

Relevant files:
- None

Relevant routes:
- None

Database tables:
- None

Permissions:
- N/A

Notes:
- None.

### Feature: Vendor notifications
Status: PARTIALLY_COMPLETED

What exists:
- `vendor_assigned` email template. No vendor notification preference center.

Relevant files:
- `src/modules/email/dispatch.ts`
- `supabase/migrations/0039_email_engine.sql`

Relevant routes:
- `/dashboard/administration/notifications`

Database tables:
- `email_templates`, `notification_logs`

Permissions:
- N/A (system email)

Notes:
- Extra recipient can include vendor email when assigned.

---

## 10. Document Management

### Feature: Document upload
Status: COMPLETED

What exists:
- Asset attachment uploader with type and expiry.

Relevant files:
- `src/modules/assets/actions.ts`
- `src/modules/storage/mutations.ts`

Relevant routes:
- `/assets/[id]`

Database tables:
- `asset_documents`

Permissions:
- `assets.edit`

Notes:
- Allow-list MIME + size.

### Feature: Document download
Status: PARTIALLY_COMPLETED

What exists:
- Files served as `/api/media/{key}` with public cache headers if the key is known. Attachment list uses `mediaSrc`.

Relevant files:
- `src/app/api/media/[...key]/route.ts`
- `src/lib/media-url.ts`

Relevant routes:
- `/api/media/[...key]`

Database tables:
- `asset_documents.file_path`

Permissions:
- No session check on media route

Notes:
- Comment in 0011 mentioned signed URLs; implementation is key-based public media.

### Feature: Document preview
Status: PARTIALLY_COMPLETED

What exists:
- Images can render via next/image or media URL. No PDF/in-app previewer component dedicated to documents.

Relevant files:
- `src/components/assets/attachment-uploader.tsx`

Relevant routes:
- `/assets/[id]`

Database tables:
- `asset_documents.mime_type`

Permissions:
- `assets.view` implied by page access

Notes:
- PDF is in the storage allow-list.

### Feature: Document types
Status: COMPLETED

What exists:
- Catalog `document_types` seeded (invoice, warranty, manual, photo, amc, insurance, handover, other). Uploader select.

Relevant files:
- `supabase/migrations/0040_reports_docs.sql`
- `src/modules/assets/actions.ts` (`getDocumentTypesForForm`)

Relevant routes:
- `/assets/[id]`, `/dashboard/administration/categories`

Database tables:
- `document_types`

Permissions:
- Read with asset/category forms

Notes:
- No admin editor for custom document types.

### Feature: Asset-linked documents
Status: COMPLETED

What exists:
- `asset_documents.asset_id`.

Relevant files:
- `src/modules/assets/queries.ts`

Relevant routes:
- `/assets/[id]`

Database tables:
- `asset_documents`

Permissions:
- `assets.edit` to upload

Notes:
- None.

### Feature: Vendor-linked documents
Status: NOT_FOUND

What exists:
- No vendor_id on documents.

Relevant files:
- None

Relevant routes:
- None

Database tables:
- None

Permissions:
- N/A

Notes:
- None.

### Feature: Employee-linked documents
Status: NOT_FOUND

What exists:
- No user/employee document store.

Relevant files:
- None

Relevant routes:
- None

Database tables:
- None

Permissions:
- N/A

Notes:
- None.

### Feature: Contract-linked documents
Status: NOT_FOUND

What exists:
- No contracts.

Relevant files:
- None

Relevant routes:
- None

Database tables:
- None

Permissions:
- N/A

Notes:
- None.

### Feature: Issue date
Status: NOT_FOUND

What exists:
- `created_at` upload time only. No issue_date column.

Relevant files:
- None

Relevant routes:
- None

Database tables:
- `asset_documents.created_at`

Permissions:
- N/A

Notes:
- None.

### Feature: Expiry date
Status: COMPLETED

What exists:
- `asset_documents.expires_at`.

Relevant files:
- `src/components/assets/attachment-uploader.tsx`

Relevant routes:
- `/assets/[id]`

Database tables:
- `asset_documents.expires_at`

Permissions:
- `assets.edit`

Notes:
- None.

### Feature: Document reminders
Status: COMPLETED

What exists:
- Rules for `document_expiry` at 30/7/0 days. Cron scheduler.

Relevant files:
- `supabase/migrations/0041_document_expiry_rules.sql`
- `src/modules/email/scheduler.ts`

Relevant routes:
- Cron, notifications admin

Database tables:
- `notification_rules`, `notification_logs`

Permissions:
- Cron

Notes:
- Earlier review noted reminder URLs may use document id rather than asset id.

### Feature: Document versioning
Status: NOT_FOUND

What exists:
- Each upload is a new row. No version number or replace-in-place.

Relevant files:
- None

Relevant routes:
- None

Database tables:
- None

Permissions:
- N/A

Notes:
- None.

### Feature: Document approval
Status: NOT_FOUND

What exists:
- No approval status on documents.

Relevant files:
- None

Relevant routes:
- None

Database tables:
- None

Permissions:
- N/A

Notes:
- None.

### Feature: Document permissions
Status: PARTIALLY_COMPLETED

What exists:
- RLS tenant isolation. Upload gated by `assets.edit`. Media bytes are not permission-checked.

Relevant files:
- `src/modules/storage/actions.ts`

Relevant routes:
- `/api/media/[...key]`

Database tables:
- `asset_documents`

Permissions:
- Tenant RLS + `assets.edit`

Notes:
- Production hardening: unguessable keys, not ACLs.

### Feature: Document activity history
Status: NOT_FOUND

What exists:
- No document-specific audit trail.

Relevant files:
- None

Relevant routes:
- None

Database tables:
- None

Permissions:
- N/A

Notes:
- `writeAuditLog` not used on upload.

### Feature: Expired document dashboard
Status: PARTIALLY_COMPLETED

What exists:
- Dashboard tiles include warranty/AMC style counts via reports module. No dedicated expired-documents page. Email reminders exist.

Relevant files:
- `src/modules/reports/queries.ts`
- `src/app/(dashboard)/dashboard/page.tsx`

Relevant routes:
- `/dashboard`

Database tables:
- `asset_documents.expires_at`

Permissions:
- Authenticated dashboard

Notes:
- Tile set is generic (missing location, overdue maintenance, etc.), not a document expiry board.

---

## 11. Reports and Dashboard

### Feature: Main dashboard
Status: COMPLETED

What exists:
- Tiles + bar charts: category, status, open tickets.

Relevant files:
- `src/app/(dashboard)/dashboard/page.tsx`

Relevant routes:
- `/dashboard`

Database tables:
- RPCs `get_asset_counts_by_category`, `get_asset_counts_by_status`

Permissions:
- Any authenticated tenant user (sidebar always shows Dashboard)

Notes:
- Not role-specific.

### Feature: Admin dashboard
Status: PARTIALLY_COMPLETED

What exists:
- Administration index redirects to the first permitted section. Super-admin `/admin` is company list, not analytics.

Relevant files:
- `src/app/(dashboard)/dashboard/administration/page.tsx`
- `src/app/(admin)/admin/(protected)/page.tsx`

Relevant routes:
- `/dashboard/administration`, `/admin`

Database tables:
- companies (platform)

Permissions:
- Super admin for `/admin`

Notes:
- No separate admin KPI dashboard.

### Feature: Employee dashboard
Status: NOT_FOUND

What exists:
- Same `/dashboard` for all tenant users.

Relevant files:
- None

Relevant routes:
- `/dashboard`

Database tables:
- N/A

Permissions:
- N/A

Notes:
- None.

### Feature: Vendor dashboard
Status: NOT_FOUND

What exists:
- Vendors see the same dashboard; charts/tiles are RLS-filtered to visible assets/tickets.

Relevant files:
- `src/app/(dashboard)/dashboard/page.tsx`

Relevant routes:
- `/dashboard`

Database tables:
- N/A

Permissions:
- Vendor role

Notes:
- Not a dedicated vendor home.

### Feature: Auditor dashboard
Status: PARTIALLY_COMPLETED

What exists:
- `/floor/audits` list of active campaigns. Desk audit list with progress.

Relevant files:
- `src/app/(floor)/floor/audits/page.tsx`

Relevant routes:
- `/floor/audits`

Database tables:
- `audits`

Permissions:
- `audits.view`

Notes:
- Not a separate auditor persona dashboard.

### Feature: Asset reports
Status: COMPLETED

What exists:
- `asset_register`, `by_status`, `missing_unassigned`.

Relevant files:
- `src/modules/reports/types.ts`

Relevant routes:
- `/dashboard/administration/reports`

Database tables:
- `assets`

Permissions:
- `reports.export`

Notes:
- None.

### Feature: Location reports
Status: COMPLETED

What exists:
- `by_location`.

Relevant files:
- `src/modules/reports/queries.ts`

Relevant routes:
- `/dashboard/administration/reports`

Database tables:
- `assets`, `locations`

Permissions:
- `reports.export`

Notes:
- None.

### Feature: Department reports
Status: NOT_FOUND

What exists:
- No departments.

Relevant files:
- None

Relevant routes:
- None

Database tables:
- None

Permissions:
- N/A

Notes:
- None.

### Feature: Maintenance reports
Status: COMPLETED

What exists:
- `maintenance_overdue`.

Relevant files:
- `src/modules/reports/queries.ts`

Relevant routes:
- `/dashboard/administration/reports`

Database tables:
- `maintenance_tickets`

Permissions:
- `reports.export`

Notes:
- None.

### Feature: Audit reports
Status: COMPLETED

What exists:
- `audit_exceptions` plus per-audit export.

Relevant files:
- `src/modules/reports/queries.ts`
- `src/modules/audits/actions.ts`

Relevant routes:
- `/dashboard/administration/reports`

Database tables:
- `audit_items`

Permissions:
- `reports.export` / `audits.view`

Notes:
- None.

### Feature: Vendor reports
Status: NOT_FOUND

What exists:
- No vendor performance export.

Relevant files:
- None

Relevant routes:
- None

Database tables:
- None

Permissions:
- N/A

Notes:
- None.

### Feature: Document reports
Status: NOT_FOUND

What exists:
- No document expiry export key.

Relevant files:
- None

Relevant routes:
- None

Database tables:
- `asset_documents` unused by report keys

Permissions:
- N/A

Notes:
- None.

### Feature: Warranty reports
Status: COMPLETED

What exists:
- Combined `warranty_amc` report (warranty, AMC, insurance dates).

Relevant files:
- `src/modules/reports/types.ts`

Relevant routes:
- `/dashboard/administration/reports`

Database tables:
- `assets`

Permissions:
- `reports.export`

Notes:
- Not a standalone warranty-only report.

### Feature: AMC reports
Status: COMPLETED

What exists:
- Same `warranty_amc` export.

Relevant files:
- `src/modules/reports/types.ts`

Relevant routes:
- `/dashboard/administration/reports`

Database tables:
- `assets`

Permissions:
- `reports.export`

Notes:
- Grouped with warranty.

### Feature: Disposal reports
Status: PARTIALLY_COMPLETED

What exists:
- Dispose action sets final status. `by_status` can include disposed if such a status exists. No dedicated disposal report.

Relevant files:
- `src/modules/custody/actions.ts` (`disposeAssetAction`)

Relevant routes:
- `/assets/[id]`

Database tables:
- `assets.status_id`

Permissions:
- `assets.edit`

Notes:
- None.

### Feature: Dashboard widgets
Status: COMPLETED

What exists:
- Count tiles with links (missing location, unassigned, overdue maintenance, warranty, audit exceptions).

Relevant files:
- `src/modules/reports/queries.ts`

Relevant routes:
- `/dashboard`

Database tables:
- various

Permissions:
- Authenticated

Notes:
- Not user-configurable widgets.

### Feature: Charts
Status: COMPLETED

What exists:
- Simple bar chart component.

Relevant files:
- `src/components/charts/simple-bar-chart.tsx`

Relevant routes:
- `/dashboard`

Database tables:
- aggregate RPCs

Permissions:
- N/A

Notes:
- None.

### Feature: Filters (reports)
Status: PARTIALLY_COMPLETED

What exists:
- Report picker + csv/xlsx format. No date range or location filter on exports.

Relevant files:
- `src/app/(dashboard)/dashboard/administration/reports/reports-admin.tsx`

Relevant routes:
- `/dashboard/administration/reports`

Database tables:
- N/A

Permissions:
- `reports.export`

Notes:
- None.

### Feature: CSV export
Status: COMPLETED

What exists:
- `tableToCsv` download from reports admin.

Relevant files:
- `src/modules/reports/actions.ts`

Relevant routes:
- `/dashboard/administration/reports`

Database tables:
- report queries

Permissions:
- `reports.export`

Notes:
- None.

### Feature: Excel export
Status: PARTIALLY_COMPLETED

What exists:
- Format option `xlsx` downloads SpreadsheetML XML with `.xls` filename and `application/vnd.ms-excel`. Not Office Open XML `.xlsx`.

Relevant files:
- `src/modules/reports/actions.ts` (`tableToExcelXml`)

Relevant routes:
- `/dashboard/administration/reports`

Database tables:
- N/A

Permissions:
- `reports.export`

Notes:
- Excel can often open it; it is not a true xlsx workbook.

### Feature: PDF export
Status: NOT_FOUND

What exists:
- PDF only as an allowed upload MIME type.

Relevant files:
- `src/modules/storage/types.ts`

Relevant routes:
- None

Database tables:
- None

Permissions:
- N/A

Notes:
- None.

### Feature: Scheduled reports
Status: NOT_FOUND

What exists:
- No report schedule table or email of reports.

Relevant files:
- None

Relevant routes:
- None

Database tables:
- None

Permissions:
- N/A

Notes:
- None.

### Feature: Custom report builder
Status: NOT_FOUND

What exists:
- Fixed `REPORT_KEYS` only.

Relevant files:
- `src/modules/reports/types.ts`

Relevant routes:
- `/dashboard/administration/reports`

Database tables:
- None

Permissions:
- N/A

Notes:
- None.

---

## 12. Import and Export

### Feature: CSV import
Status: COMPLETED

What exists:
- Upload CSV, preview, commit, error CSV.

Relevant files:
- `src/modules/reports/actions.ts` (`previewImportAction`, `commitImportAction`)

Relevant routes:
- `/dashboard/administration/reports`

Database tables:
- `import_jobs`

Permissions:
- `assets.create` + reports module

Notes:
- Asset import only.

### Feature: Excel import
Status: NOT_FOUND

What exists:
- Parser is CSV text. No xlsx parser.

Relevant files:
- `src/modules/reports/actions.ts` (`parseCsv`)

Relevant routes:
- `/dashboard/administration/reports`

Database tables:
- None

Permissions:
- N/A

Notes:
- None.

### Feature: Asset import
Status: COMPLETED

What exists:
- Template CSV, validation per row, creates assets.

Relevant files:
- `src/modules/reports/actions.ts`

Relevant routes:
- `/dashboard/administration/reports`

Database tables:
- `assets`, `import_jobs`

Permissions:
- `assets.create`

Notes:
- None.

### Feature: Location import
Status: NOT_FOUND

What exists:
- None.

Relevant files:
- None

Relevant routes:
- None

Database tables:
- None

Permissions:
- N/A

Notes:
- None.

### Feature: Employee import
Status: NOT_FOUND

What exists:
- Users are invited, not imported.

Relevant files:
- None

Relevant routes:
- None

Database tables:
- None

Permissions:
- N/A

Notes:
- None.

### Feature: Vendor import
Status: NOT_FOUND

What exists:
- None.

Relevant files:
- None

Relevant routes:
- None

Database tables:
- None

Permissions:
- N/A

Notes:
- None.

### Feature: Category import
Status: NOT_FOUND

What exists:
- None.

Relevant files:
- None

Relevant routes:
- None

Database tables:
- None

Permissions:
- N/A

Notes:
- None.

### Feature: Column mapping
Status: PARTIALLY_COMPLETED

What exists:
- Fixed template headers. No interactive mapping UI.

Relevant files:
- `src/modules/reports/actions.ts` (`getImportTemplateCsv`)

Relevant routes:
- `/dashboard/administration/reports`

Database tables:
- N/A

Permissions:
- N/A

Notes:
- None.

### Feature: Import preview
Status: COMPLETED

What exists:
- Row-level errors before commit.

Relevant files:
- `src/modules/reports/actions.ts`

Relevant routes:
- `/dashboard/administration/reports`

Database tables:
- None until commit

Permissions:
- `assets.create`

Notes:
- None.

### Feature: Validation
Status: COMPLETED

What exists:
- Per-row validation; error report CSV.

Relevant files:
- `src/modules/reports/actions.ts`

Relevant routes:
- `/dashboard/administration/reports`

Database tables:
- `import_jobs.error_report`

Permissions:
- `assets.create`

Notes:
- None.

### Feature: Duplicate detection
Status: PARTIALLY_COMPLETED

What exists:
- Unique `asset_code` at DB level will fail inserts. Preview may flag some issues. No fuzzy duplicate-by-serial UI.

Relevant files:
- `src/modules/reports/actions.ts`

Relevant routes:
- `/dashboard/administration/reports`

Database tables:
- `assets` unique (company_id, asset_code)

Permissions:
- N/A

Notes:
- None.

### Feature: Import rollback
Status: NOT_FOUND

What exists:
- Jobs stored as completed counts. No undo.

Relevant files:
- `src/modules/reports/mutations.ts`

Relevant routes:
- None

Database tables:
- `import_jobs`

Permissions:
- N/A

Notes:
- None.

### Feature: Import history
Status: COMPLETED

What exists:
- List of jobs with counts and error report.

Relevant files:
- `src/modules/reports/actions.ts` (`getImportJobsForAdmin`)

Relevant routes:
- `/dashboard/administration/reports`

Database tables:
- `import_jobs`

Permissions:
- `reports.view`

Notes:
- None.

### Feature: CSV export
Status: COMPLETED

What exists:
- See Reports CSV export.

Relevant files:
- `src/modules/reports/actions.ts`

Relevant routes:
- `/dashboard/administration/reports`

Database tables:
- N/A

Permissions:
- `reports.export`

Notes:
- None.

### Feature: Excel export
Status: PARTIALLY_COMPLETED

What exists:
- See Excel export under reports.

Relevant files:
- `src/modules/reports/actions.ts`

Relevant routes:
- `/dashboard/administration/reports`

Database tables:
- N/A

Permissions:
- `reports.export`

Notes:
- None.

### Feature: Filtered export
Status: NOT_FOUND

What exists:
- Exports dump the full report query, not current asset-list filters.

Relevant files:
- `src/modules/reports/queries.ts`

Relevant routes:
- `/dashboard/administration/reports`

Database tables:
- N/A

Permissions:
- `reports.export`

Notes:
- None.

### Feature: Bulk export
Status: PARTIALLY_COMPLETED

What exists:
- Whole-register export via `asset_register`. No async job for very large sets.

Relevant files:
- `src/modules/reports/queries.ts`

Relevant routes:
- `/dashboard/administration/reports`

Database tables:
- `assets`

Permissions:
- `reports.export`

Notes:
- Loads report in one request.

### Feature: Export permissions
Status: COMPLETED

What exists:
- `reports.export` required. Taxonomy includes `export` on all modules but only reports export is implemented.

Relevant files:
- `src/lib/permissions/taxonomy.ts`
- `src/modules/reports/actions.ts`

Relevant routes:
- `/dashboard/administration/reports`

Database tables:
- `roles.permissions`

Permissions:
- `reports.export`

Notes:
- `assets.export` key unused.

### Feature: Large export support
Status: NOT_FOUND

What exists:
- No streaming, chunking, or background export.

Relevant files:
- None

Relevant routes:
- None

Database tables:
- None

Permissions:
- N/A

Notes:
- None.

### Feature: Multiple worksheets
Status: NOT_FOUND

What exists:
- Single table per download.

Relevant files:
- `src/modules/reports/actions.ts`

Relevant routes:
- None

Database tables:
- None

Permissions:
- N/A

Notes:
- None.

---

## 13. Notifications and Emails

### Feature: In-app notifications
Status: COMPLETED

What exists:
- Bell for storage-threshold notifications. Mark one/all read.

Relevant files:
- `src/modules/notifications/actions.ts`
- `src/components/layout/notification-bell.tsx`

Relevant routes:
- Dashboard shell

Database tables:
- `notifications`

Permissions:
- Any tenant member can read company notifications (RLS)

Notes:
- Sources are storage warnings (`check_storage_thresholds`), not custody/audit events.

### Feature: Email notifications
Status: COMPLETED

What exists:
- Brevo templated send for assignment, return, transfer, maintenance, vendor, expiry reminders.

Relevant files:
- `src/lib/email.ts`
- `src/modules/email/dispatch.ts`

Relevant routes:
- Cron + event dispatch

Database tables:
- `email_templates`, `notification_logs`

Permissions:
- System

Notes:
- Delivery `NOT_VERIFIED` without Brevo credentials.

### Feature: Email templates
Status: COMPLETED

What exists:
- Per-company templates editable in notifications admin. Test send rate-limited.

Relevant files:
- `src/modules/email/actions.ts`
- `src/app/(dashboard)/dashboard/administration/notifications/page.tsx`

Relevant routes:
- `/dashboard/administration/notifications`

Database tables:
- `email_templates`

Permissions:
- `notifications.view/edit`

Notes:
- None.

### Feature: Notification preferences
Status: PARTIALLY_COMPLETED

What exists:
- Enable/disable templates and reminder rules (admin). No per-user preference table.

Relevant files:
- `src/modules/email/actions.ts` (`toggleNotificationRuleAction`)

Relevant routes:
- `/dashboard/administration/notifications`

Database tables:
- `notification_rules.is_enabled`, `email_templates.is_enabled`

Permissions:
- `notifications.edit`

Notes:
- Recipients are `admins` (company admin emails), not user-selected.

### Feature: Maintenance reminders
Status: COMPLETED

What exists:
- `maintenance_due` rules.

Relevant files:
- `src/modules/email/scheduler.ts`

Relevant routes:
- Cron

Database tables:
- `notification_rules`

Permissions:
- Cron

Notes:
- None.

### Feature: Warranty reminders
Status: COMPLETED

What exists:
- `warranty_expiry` 30/15/7/1/0.

Relevant files:
- `supabase/migrations/0039_email_engine.sql`

Relevant routes:
- Cron

Database tables:
- `notification_rules`

Permissions:
- Cron

Notes:
- None.

### Feature: AMC reminders
Status: COMPLETED

What exists:
- `amc_expiry` 30/7/0.

Relevant files:
- `supabase/migrations/0039_email_engine.sql`

Relevant routes:
- Cron

Database tables:
- `notification_rules`

Permissions:
- Cron

Notes:
- None.

### Feature: Document expiry reminders
Status: COMPLETED

What exists:
- Seeded in 0041.

Relevant files:
- `supabase/migrations/0041_document_expiry_rules.sql`

Relevant routes:
- Cron

Database tables:
- `notification_rules`

Permissions:
- Cron

Notes:
- None.

### Feature: Audit reminders
Status: NOT_FOUND

What exists:
- No `audit_*` email templates or rules.

Relevant files:
- None

Relevant routes:
- None

Database tables:
- None

Permissions:
- N/A

Notes:
- None.

### Feature: Assignment notifications
Status: COMPLETED

What exists:
- `asset_assigned` email on handover.

Relevant files:
- `src/modules/custody/actions.ts`
- `src/modules/email/dispatch.ts`

Relevant routes:
- `/assets/[id]`

Database tables:
- `notification_logs`

Permissions:
- Triggered by handover

Notes:
- In-app bell does not show assignment events.

### Feature: Return reminders
Status: NOT_FOUND

What exists:
- `asset_returned` email after return, not a reminder before due date.

Relevant files:
- `src/modules/email/dispatch.ts`

Relevant routes:
- None for reminders

Database tables:
- None for expected return

Permissions:
- N/A

Notes:
- None.

### Feature: Approval notifications
Status: NOT_FOUND

What exists:
- No approval workflows.

Relevant files:
- None

Relevant routes:
- None

Database tables:
- None

Permissions:
- N/A

Notes:
- None.

### Feature: Email logs
Status: COMPLETED

What exists:
- `notification_logs` listed in notifications admin.

Relevant files:
- `src/modules/email/actions.ts` (`getNotificationLogsForAdmin`)

Relevant routes:
- `/dashboard/administration/notifications`

Database tables:
- `notification_logs`

Permissions:
- `notifications.view`

Notes:
- Unique (company, event, occurrence, recipient) for idempotency.

### Feature: Failed email logs
Status: COMPLETED

What exists:
- Status `failed` with error text.

Relevant files:
- `src/modules/email/dispatch.ts`

Relevant routes:
- `/dashboard/administration/notifications`

Database tables:
- `notification_logs.status`, `error`

Permissions:
- `notifications.view`

Notes:
- None.

### Feature: Email retry
Status: NOT_FOUND

What exists:
- Failed rows are not retried. Unique constraint also blocks a second send for the same occurrence.

Relevant files:
- `src/modules/email/dispatch.ts`

Relevant routes:
- None

Database tables:
- `notification_logs` unique key

Permissions:
- N/A

Notes:
- Idempotency is by design; there is no retry job.

### Feature: Cron jobs
Status: COMPLETED

What exists:
- Vercel cron daily 06:00 UTC → `/api/cron/notifications`. Supabase `pg_cron` for `check_storage_thresholds` (migration 0018).

Relevant files:
- `vercel.json`
- `src/app/api/cron/notifications/route.ts`
- `supabase/migrations/0018_storage_and_notifications.sql`

Relevant routes:
- `/api/cron/notifications`

Database tables:
- N/A (job runner)

Permissions:
- `Authorization: Bearer CRON_SECRET`; if secret unset, all requests 401

Notes:
- `CRON_SECRET` not listed in `.env.example` (production hardening).

### Feature: Scheduled notifications
Status: COMPLETED

What exists:
- Offset-day rules evaluated by `runScheduledReminders`.

Relevant files:
- `src/modules/email/scheduler.ts`

Relevant routes:
- Cron

Database tables:
- `notification_rules`

Permissions:
- Cron

Notes:
- None.

### Feature: Escalation notifications
Status: NOT_FOUND

What exists:
- No escalation engine.

Relevant files:
- None

Relevant routes:
- None

Database tables:
- None

Permissions:
- N/A

Notes:
- None.

---

## 14. Approvals and Workflows

No generic workflow engine. Each candidate:

### Feature: Asset requests
Status: NOT_FOUND

Trigger / levels / roles / statuses / rejection / notifications / audit logs:
- Not implemented.

### Feature: Asset assignment approval
Status: NOT_FOUND

Notes:
- Handover executes immediately; acknowledgement is after-the-fact, not an approval chain.

### Feature: Asset transfer approval
Status: NOT_FOUND

Notes:
- Transfer executes immediately. `acknowledged_at` unused in the transfer action.

### Feature: Asset return approval
Status: PARTIALLY_COMPLETED

Trigger: `returnAssetAction`
Approval levels: none (single actor)
Approver roles: user with `handover.assign`
Statuses: return row inserted; asset unassigned
Rejection handling: none
Notifications: `asset_returned` email
Audit logs: `writeAuditLog` `asset.return`

Notes:
- `approved_by` is the acting user, not a second approver.

### Feature: Maintenance completion approval
Status: NOT_FOUND

Notes:
- Status `resolved` is set by `maintenance.edit` with no extra approver.

### Feature: Audit closure approval
Status: NOT_FOUND

Notes:
- `completeAuditAction` is a single permission check.

### Feature: Vendor onboarding approval
Status: NOT_FOUND

Notes:
- Vendor create is immediate.

### Feature: Document approval
Status: NOT_FOUND

### Feature: Disposal approval
Status: NOT_FOUND

Notes:
- `disposeAssetAction` requires `assets.edit` and writes `asset.disposed` audit log. No multi-step approval.

### Feature: Purchase requests
Status: NOT_FOUND

### Feature: Contract approval
Status: NOT_FOUND

---

## 15. Admin and Super Admin

### Feature: Super-admin dashboard
Status: COMPLETED

What exists:
- Protected `/admin` with companies, leads, plans, orders, storage.

Relevant files:
- `src/app/(admin)/admin/(protected)/layout.tsx`
- `src/lib/permissions/super-admin.ts`

Relevant routes:
- `/admin`

Database tables:
- `platform_admins`

Permissions:
- `platform_admins` membership

Notes:
- Tenant users hitting `/admin` are redirected to `/dashboard`.

### Feature: Organization management
Status: COMPLETED

What exists:
- List, create (with admin invite), update name/slug/dedicated flag, delete.

Relevant files:
- `src/modules/companies/actions.ts`

Relevant routes:
- `/admin`, `/admin/companies/new`

Database tables:
- `companies`

Permissions:
- Super admin

Notes:
- None.

### Feature: User management (platform)
Status: PARTIALLY_COMPLETED

What exists:
- Super admin creates the first company admin via invite. Tenant user management is inside the company. No platform-wide user directory.

Relevant files:
- `src/modules/companies/actions.ts`

Relevant routes:
- `/admin`, `/dashboard/administration/users`

Database tables:
- `users`, `company_invites`

Permissions:
- Super admin vs `users.*`

Notes:
- None.

### Feature: Subscription management
Status: COMPLETED

What exists:
- Assign plan, grant extra assets, view snapshots.

Relevant files:
- `src/modules/billing/actions.ts`

Relevant routes:
- `/admin`, `/admin/orders`

Database tables:
- `company_subscriptions`

Permissions:
- Super admin

Notes:
- None.

### Feature: Plan management
Status: COMPLETED

What exists:
- CRUD plans.

Relevant files:
- `src/modules/billing/actions.ts`

Relevant routes:
- `/admin/plans`

Database tables:
- `billing_plans`

Permissions:
- Super admin

Notes:
- None.

### Feature: Module management
Status: PARTIALLY_COMPLETED

What exists:
- Per-tenant enabled_modules in workspace settings. Super admin has no separate module catalog UI; they bypass feature flags.

Relevant files:
- `src/lib/permissions/feature-catalog.ts`

Relevant routes:
- `/dashboard/administration/settings`

Database tables:
- `company_settings.enabled_modules`

Permissions:
- Tenant `settings.edit`

Notes:
- Not a platform feature-flag service.

### Feature: Tenant access
Status: PARTIALLY_COMPLETED

What exists:
- Super admin RLS bypass. Company detail dialog. No “open tenant as admin” session switch.

Relevant files:
- `src/app/(admin)/admin/(protected)/company-detail-dialog.tsx`

Relevant routes:
- `/admin`

Database tables:
- `platform_admins`

Permissions:
- Super admin

Notes:
- Super admin on `/tag` is read-only and does not open the workspace.

### Feature: Impersonation
Status: NOT_FOUND

What exists:
- No impersonate action or audit of impersonation.

Relevant files:
- None

Relevant routes:
- None

Database tables:
- None

Permissions:
- N/A

Notes:
- None.

### Feature: System activity logs
Status: PARTIALLY_COMPLETED

What exists:
- Per-company `audit_log`. Super admin can bypass RLS to read all. No platform-wide log UI.

Relevant files:
- `src/modules/activity/queries.ts`

Relevant routes:
- `/dashboard/administration/activity` (tenant)

Database tables:
- `audit_log`

Permissions:
- Tenant `settings.view`; super admin bypass

Notes:
- None.

### Feature: Platform settings
Status: NOT_FOUND

What exists:
- No global settings table (SMTP, legal, maintenance mode). Env vars only.

Relevant files:
- None

Relevant routes:
- None

Database tables:
- None

Permissions:
- N/A

Notes:
- None.

### Feature: Feature flags
Status: PARTIALLY_COMPLETED

What exists:
- Tenant `enabled_modules` only. No LaunchDarkly-style or platform flags table.

Relevant files:
- `src/lib/permissions/features.ts`

Relevant routes:
- `/dashboard/administration/settings`

Database tables:
- `company_settings.enabled_modules`

Permissions:
- `settings.edit`

Notes:
- Grouped with module enable/disable.

### Feature: Billing controls
Status: COMPLETED

What exists:
- Plans, assign, extra assets, fulfill/cancel orders, Razorpay webhook.

Relevant files:
- `src/modules/billing/actions.ts`

Relevant routes:
- `/admin/plans`, `/admin/orders`

Database tables:
- billing tables

Permissions:
- Super admin

Notes:
- None.

### Feature: Organization suspension
Status: NOT_FOUND

What exists:
- Subscription `halted`/`canceled` from Razorpay. No `companies.suspended` flag or login block.

Relevant files:
- `src/modules/billing/types.ts`

Relevant routes:
- None

Database tables:
- `company_subscriptions.status`

Permissions:
- N/A

Notes:
- Asset creation still quota-gated; login is not blocked on halted.

### Feature: Organization deletion
Status: COMPLETED

What exists:
- `deleteCompanyAction` cascades via FKs.

Relevant files:
- `src/modules/companies/mutations.ts`
- `src/modules/billing/actions.ts` (also `deleteCompany` on failed signup)

Relevant routes:
- `/admin` company dialog

Database tables:
- `companies` ON DELETE CASCADE

Permissions:
- Super admin

Notes:
- R2 object cleanup on delete is `NOT_VERIFIED` from company delete path.

---

## 16. Security and Compliance

### Feature: Supabase RLS
Status: COMPLETED

What exists:
- RLS enabled on tenant tables with tenant isolation + super-admin bypass. `audit_log` and `notification_logs` are select-only for tenants.

Relevant files:
- `supabase/migrations/*.sql`

Relevant routes:
- N/A

Database tables:
- All listed in TAGX_DATABASE_FEATURE_MAP.md

Permissions:
- Postgres policies

Notes:
- Documented issues: public media; public asset tag via service role.

### Feature: Tenant isolation
Status: COMPLETED

What exists:
- See Organization tenant isolation.

Relevant files:
- `src/middleware.ts`

Relevant routes:
- All

Database tables:
- `company_id` columns

Permissions:
- Derived from session

Notes:
- Login also checks profile.company_id vs slug.

### Feature: Server-side permission checks
Status: PARTIALLY_COMPLETED

What exists:
- Mutating actions generally call `requirePermission`. Several reads (asset list, dashboard aggregates, category list GET) skip it and rely on RLS + hidden nav.

Relevant files:
- `src/modules/*/actions.ts`

Relevant routes:
- Direct URLs to admin pages still render empty/partial UI

Database tables:
- `roles.permissions`

Permissions:
- Mixed

Notes:
- Super admin bypasses permission checks.

### Feature: Module-level permission checks
Status: PARTIALLY_COMPLETED

What exists:
- `requireModule` on vendors, handover, reports, maintenance writes, PM. Audit mutations do not call `requireModule`.

Relevant files:
- `src/lib/permissions/features.ts`

Relevant routes:
- Admin nav hides disabled features

Database tables:
- `company_settings.enabled_modules`

Permissions:
- Feature flags AND RBAC

Notes:
- None.

### Feature: API authentication
Status: PARTIALLY_COMPLETED

What exists:
- Cron: bearer secret. Razorpay webhook: signature. Media: none. Server actions: session cookies. Middleware matcher skips `/api`.

Relevant files:
- `src/app/api/cron/notifications/route.ts`
- `src/app/api/razorpay/webhook/route.ts`
- `src/middleware.ts` `config.matcher`

Relevant routes:
- `/api/*`

Database tables:
- N/A

Permissions:
- Mixed

Notes:
- None.

### Feature: Secure file access
Status: PARTIALLY_COMPLETED

What exists:
- Keys under `companies/{id}/...` with UUID filenames. `isCompanyObjectKey` validation. No per-user ACL.

Relevant files:
- `src/lib/r2/client.ts`
- `src/modules/storage/actions.ts`

Relevant routes:
- `/api/media/[...key]`

Database tables:
- `asset_documents.file_path`

Permissions:
- None on GET

Notes:
- Comment in migration 0011 is outdated (signed URLs not implemented).

### Feature: Signed file URLs
Status: NOT_FOUND

What exists:
- Public media proxy, not time-limited signed R2 URLs.

Relevant files:
- `src/app/api/media/[...key]/route.ts`

Relevant routes:
- `/api/media/[...key]`

Database tables:
- None

Permissions:
- N/A

Notes:
- None.

### Feature: Invitation token security
Status: PARTIALLY_COMPLETED

What exists:
- 32-byte random hex tokens, unique index, expiry, single accept. Stored plaintext. Lookup by token via admin client.

Relevant files:
- `src/modules/companies/mutations.ts`
- `src/modules/users/queries.ts`

Relevant routes:
- `/invite/[token]`

Database tables:
- `company_invites.token`

Permissions:
- N/A

Notes:
- Token in URL is a capability. Not hashed at rest.

### Feature: Cron authentication
Status: COMPLETED

What exists:
- Requires `CRON_SECRET`. Missing secret fails closed.

Relevant files:
- `src/app/api/cron/notifications/route.ts`

Relevant routes:
- `/api/cron/notifications`

Database tables:
- N/A

Permissions:
- Shared secret

Notes:
- GET and POST both invoke the job.

### Feature: Rate limiting
Status: PARTIALLY_COMPLETED

What exists:
- In-memory limiter: signup, CRM lead, extra-asset request, test email. Not used on login.

Relevant files:
- `src/lib/rate-limit.ts`

Relevant routes:
- `/signup`, `/inquire`, settings extra assets, notifications test

Database tables:
- None (process memory)

Permissions:
- N/A

Notes:
- Not shared across serverless instances.

### Feature: Login protection
Status: PARTIALLY_COMPLETED

What exists:
- Generic invalid-credentials message. Company mismatch signs out. No lockout, no rate limit, no 2FA.

Relevant files:
- `src/modules/users/actions.ts`

Relevant routes:
- `/{slug}/login`, `/admin/login`

Database tables:
- None

Permissions:
- N/A

Notes:
- Deactivated users not blocked.

### Feature: Audit logs
Status: PARTIALLY_COMPLETED

What exists:
- See User activity log. Coverage incomplete.

Relevant files:
- `src/lib/audit-log.ts`

Relevant routes:
- `/dashboard/administration/activity`

Database tables:
- `audit_log`

Permissions:
- Service-role writes

Notes:
- None.

### Feature: Sensitive field restrictions
Status: COMPLETED

What exists:
- Public tag omits purchase, insurance, allotment, documents.

Relevant files:
- `src/modules/assets/queries.ts` (`getPublicAssetById`)

Relevant routes:
- `/tag/[id]`

Database tables:
- N/A

Permissions:
- Column allow-list

Notes:
- Authenticated asset page shows financials to anyone who can open `/assets/[id]` (RLS, not field-level).

### Feature: Vendor data restrictions
Status: COMPLETED

What exists:
- RLS on assets and tickets for `current_vendor_id()`.

Relevant files:
- `supabase/migrations/0038_vendors_pm.sql`

Relevant routes:
- `/assets`, maintenance

Database tables:
- `assets`, `maintenance_tickets`

Permissions:
- Vendor role + RLS

Notes:
- Other tables (locations, categories) remain tenant-wide if the vendor navigates there.

### Feature: Export permissions
Status: COMPLETED

What exists:
- `reports.export` on export action.

Relevant files:
- `src/modules/reports/actions.ts`

Relevant routes:
- `/dashboard/administration/reports`

Database tables:
- `roles.permissions`

Permissions:
- `reports.export`

Notes:
- None.

### Feature: Document permissions
Status: PARTIALLY_COMPLETED

What exists:
- See Document permissions above.

Relevant files:
- `src/modules/storage/actions.ts`

Relevant routes:
- `/api/media/[...key]`

Database tables:
- `asset_documents`

Permissions:
- Incomplete at byte-serving layer

Notes:
- None.

### Feature: Secret management
Status: PARTIALLY_COMPLETED

What exists:
- Env-based: Supabase, R2, Brevo, Razorpay, CRON_SECRET. Server-only modules.

Relevant files:
- `src/lib/r2/client.ts`, `src/lib/razorpay.ts`, `src/lib/email.ts`

Relevant routes:
- N/A

Database tables:
- None for secrets

Permissions:
- N/A

Notes:
- `.env.example` contents were previously observed to include live-looking values (`NOT_VERIFIED` if still present). Secrets must not be committed.

---

## Other implemented surfaces (not in the original lettered lists)

### Feature: Marketing site and CRM leads
Status: COMPLETED

What exists:
- Landing, demo, inquire, SEO page. Lead form rate-limited. Super-admin lead inbox.

Relevant files:
- `src/modules/crm/actions.ts`
- `src/app/inquire/page.tsx`

Relevant routes:
- `/`, `/demo`, `/inquire`, `/asset-management-system`, `/admin/leads`

Database tables:
- `crm_leads`

Permissions:
- Public submit; super admin manage

Notes:
- None.

### Feature: Storage usage (platform)
Status: COMPLETED

What exists:
- Super-admin storage table; `adjust_storage_used` RPC; threshold notifications.

Relevant files:
- `src/modules/storage/actions.ts`
- `src/app/(admin)/admin/(protected)/storage/page.tsx`

Relevant routes:
- `/admin/storage`

Database tables:
- `company_settings.storage_used_bytes`, `storage_limit_bytes`

Permissions:
- Super admin

Notes:
- R2 aggregation vs counter reconciliation exists in admin path.
