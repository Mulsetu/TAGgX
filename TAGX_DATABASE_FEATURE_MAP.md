# TagX Database Feature Map

Schema taken from `supabase/migrations/0001`–`0041`. Dropped tables are noted once. Application usage verified against `src/modules/**`.

---

## Global helpers and extensions

Migrations:
- `0001_extensions_and_utils.sql` — `pgcrypto`, `set_updated_at()` trigger function
- `0002_platform_admins_and_helpers.sql` — `is_super_admin()`, `current_company_id()`
- `0016_dashboard_aggregates.sql` — `get_asset_counts_by_category()`, `get_asset_counts_by_status()`
- `0017_assets_field_redesign.sql` — `increment_asset_sequence(uuid)`
- `0018_storage_and_notifications.sql` — `adjust_storage_used(uuid, bigint)`, `check_storage_thresholds()`, `pg_cron` hourly schedule
- `0038_vendors_pm.sql` — `current_vendor_id()`

Triggers: most mutable tables have `set_*_updated_at` before update.

RLS pattern (typical tenant table):
- Enable RLS
- `{table}_tenant_isolation` for `authenticated` using/checking `company_id = current_company_id()`
- `{table}_super_admin_bypass` using `is_super_admin()`

Exceptions called out per table.

---

## Table: platform_admins

Purpose:
- TagX staff identities. Not tenant-scoped.

Used by:
- Super-admin login (`signInSuperAdmin`, `checkSuperAdmin`)
- Every `*_super_admin_bypass` RLS policy via `is_super_admin()`

Important fields:
- `id` PK → `auth.users`

Related tables:
- `auth.users`

RLS status:
- Table is small; access is via SECURITY DEFINER `is_super_admin()`.

Potential issues:
- A platform admin with a `public.users` row could also enter a tenant workspace depending on profile presence (`NOT_VERIFIED` for dual membership).

---

## Table: companies

Purpose:
- Tenant root.

Used by:
- Signup, login branding, admin company CRUD, metadata, public tags

Important fields:
- `id`, `name`, `slug` (unique, format-checked)
- `logo_url`, `primary_color`, `secondary_color`
- `is_dedicated_infra` (flag only; no provisioning)
- `created_at`, `updated_at`

Related tables:
- Almost every tenant table FKs here ON DELETE CASCADE

RLS status:
- Tenant: `id = current_company_id()`. Super-admin bypass. No INSERT for authenticated (service role creates companies).

Potential issues:
- `is_dedicated_infra` unused by runtime infra.

---

## Table: reserved_slugs

Purpose:
- Block tenant slugs that collide with app routes (`signup`, `admin`, `floor`, `vendors`, etc.).

Used by:
- Company create / slug validation

Important fields:
- `slug` PK/unique

Related tables:
- None

RLS status:
- Platform table; check app queries (service role / server).

Potential issues:
- Must stay in sync with `src/lib/tenant.ts` (comment in 0032).

---

## Table: roles

Purpose:
- Per-company RBAC roles.

Used by:
- Role editor, user assignment, `getCurrentUserPermissions`

Important fields:
- `company_id`, `name` unique per company
- `is_system`
- `permissions` jsonb `{ [module]: [action, ...] }` (added 0021)

Related tables:
- `users.role_id`

RLS status:
- Tenant isolation + super-admin bypass

Potential issues:
- System Admin permissions backfilled in 0036; older custom roles may lack `vendors`/`handover`/`reports`/`assign`/`export` until edited.

---

## Tables dropped: permissions, role_permissions

Purpose (historical):
- Relational permission catalog from 0005.

Used by:
- Nothing after 0021

Notes:
- Dropped in `0021_role_permissions_jsonb.sql`. Not present in current schema.

---

## Table: users

Purpose:
- Tenant profile 1:1 with `auth.users`.

Used by:
- Auth, team admin, custodians, ticket assignees, vendor scoping

Important fields:
- `id` → `auth.users`
- `company_id`, `role_id`, `email`, `full_name`
- `is_active`
- `vendor_id` → `vendors` (0038)

Related tables:
- `roles`, `companies`, `vendors`, `assets.allotted_to`, tickets, invites

Indexes:
- `users_company_id_idx`, `users_role_id_idx`, unique `lower(email)`, `users_vendor_id_idx`

RLS status:
- Tenant isolation + super-admin bypass. No authenticated INSERT (service role).

Potential issues:
- `is_active` not enforced at login.
- Unique email is global (`lower(email)`), so one email cannot exist in two companies.

---

## Table: company_settings

Purpose:
- One row per company: storage, asset codes, feature modules.

Used by:
- Workspace settings, asset code generation, storage counter, module flags, quota UX indirectly

Important fields:
- `company_id` PK
- `storage_limit_bytes` (default 5 GiB)
- `storage_used_bytes` (0018)
- `asset_code_format`, `next_asset_sequence`
- `enabled_modules` jsonb (0036)

Related tables:
- `companies`

RLS status:
- Tenant isolation + super-admin bypass

Potential issues:
- Storage limit not tenant-editable in UI.

---

## Table: asset_categories

Purpose:
- Asset classification.

Used by:
- Category admin, asset form, dashboard counts, required documents

Important fields:
- `name`, `company_id`
- `code_prefix`, `is_active`, `default_status_id`, `default_condition_key` (0036)

Related tables:
- `assets.category_id`, `category_fields`, `category_required_documents`

RLS status:
- Tenant isolation + super-admin bypass

Potential issues:
- Required documents stored but not enforced on upload.

---

## Table: locations

Purpose:
- Physical hierarchy.

Used by:
- Location admin, asset assignment, audits, reports

Important fields:
- `name`, address fields, `parent_location_id`
- `kind` (`site|building|floor|room`) added in 0031
- Path/depth computed in application queries, not stored

Related tables:
- `assets.location_id`, `audits.location_id`, `asset_location_history`, `asset_transfers`

Indexes:
- company_id, parent_location_id

RLS status:
- Tenant isolation + super-admin bypass

Potential issues:
- Unique `(company_id, name)` can collide across sites if two rooms share a name.
- Vendor users can still read all locations via RLS (no vendor filter).

---

## Table: asset_statuses

Purpose:
- Configurable asset lifecycle statuses.

Used by:
- Status admin, asset form, filters, dashboard

Important fields:
- `name`, `sort_order`
- `color`, `is_final`, `allows_assignment` (0036)

Related tables:
- `assets.status_id`, `asset_categories.default_status_id`

RLS status:
- Tenant isolation + super-admin bypass

Potential issues:
- None found in schema.

---

## Table: asset_conditions

Purpose:
- Configurable condition catalog. `assets.condition` stores the key string.

Used by:
- Conditions admin, asset form, audits

Important fields:
- `key`, `name`, `color`, `sort_order`, `is_system`, `is_active`

Related tables:
- Snapshot only on `assets.condition` and `audit_items.expected_condition`

RLS status:
- Tenant isolation + super-admin bypass

Potential issues:
- Deleting a key does not rewrite historical asset/audit snapshots.

---

## Table: category_fields

Purpose:
- Custom field definitions per category.

Used by:
- Fields admin, asset create/edit, public tag (labels)

Important fields:
- `category_id`, `label`, `field_type`, options, required, sort
- Types: text, number, date, select, checkbox, textarea, email, url, phone

Related tables:
- `asset_categories`, values in `assets.custom_fields`

RLS status:
- Tenant isolation + super-admin bypass

Potential issues:
- None found.

---

## Table: assets

Purpose:
- Asset register.

Used by:
- Asset UI, QR, audits, maintenance, custody, reports, import, vendor RLS

Important fields:
- Identity: `name`, `asset_code` unique `(company_id, asset_code)`, `image_url`
- Catalog: `category_id`, `location_id`, `status_id`, `condition` (text key)
- Specs: `brand`, `model`, `serial_number`, `description`, `custom_fields`
- Links: `linked_asset_id`, `allotted_to`, `allotment_date`
- Purchase: `vendor` (text), `vendor_id` (FK 0038), `po_number`, invoices, `purchase_date`, `purchase_price`, `ownership_type`, `partner_name`
- Cover: warranty, AMC, insurance columns
- `qr_generated_at`, `cwip_invoice_id`, `created_by`

Related tables:
- categories, locations, statuses, users, vendors, documents, tickets, audit_items, custody tables, location history

Indexes:
- company_id, category_id, location_id, linked_asset_id; original status text index may remain or have been replaced after 0023

RLS status:
- Tenant isolation rewritten in 0038: vendor users see rows where `vendor_id` matches or the asset appears on their tickets. `WITH CHECK` forbids vendor inserts/updates.

Potential issues:
- Text `vendor` vs FK `vendor_id` not connected in the asset form.
- List/detail reads do not always call `requirePermission` (RLS only).
- Financial columns exist and are used by authenticated forms; public tag query selects a subset via admin client.

---

## Table: asset_documents

Purpose:
- Metadata for R2 files attached to assets.

Used by:
- Attachment uploader, delete asset, document expiry emails

Important fields:
- `asset_id`, `document_type` (check dropped in 0040; types live in `document_types`)
- `file_name`, `file_path`, `file_size_bytes`, `mime_type`, `uploaded_by`
- `expires_at` (0040)

Related tables:
- `assets`, `document_types` (logical, not FK)

Indexes:
- company_id, asset_id

RLS status:
- Tenant isolation + super-admin bypass

Potential issues:
- Migration comment promised signed URLs; app uses `/api/media` without session.
- No issue_date, version, approval columns.
- Required category documents not validated against this table at upload time.

---

## Table: asset_location_history

Purpose:
- Location moves.

Used by:
- Asset detail history

Important fields:
- `asset_id`, from/to location ids and names, actor, timestamp (see 0031)

Related tables:
- `assets`, `locations`

RLS status:
- Tenant isolation (0031)

Potential issues:
- None found.

---

## Table: asset_lifecycle_events

Purpose:
- Timeline entries for custody/dispose.

Used by:
- Asset custody panel

Important fields:
- `event_type`, `summary`, `payload` jsonb, `actor_id`

Related tables:
- `assets`

RLS status:
- Tenant isolation + super-admin bypass

Potential issues:
- Not written for ordinary asset field edits.

---

## Table: asset_handovers

Purpose:
- Immutable-ish handover records.

Used by:
- Custody handover + acknowledge

Important fields:
- `from_user_id`, `to_user_id`, `handed_over_at`, `accessories`, `notes`
- `acknowledged_at`, `acknowledged_by`

Related tables:
- `assets`, `users`

RLS status:
- Tenant isolation + super-admin bypass

Potential issues:
- No expected_return_date.

---

## Table: asset_returns

Purpose:
- Return records.

Used by:
- `returnAssetAction`

Important fields:
- `from_user_id`, `returned_at`, `condition_key`, `damage_remarks`, `missing_accessories`, `inspection_result`, `approved_by`

Related tables:
- `assets`

RLS status:
- Tenant isolation + super-admin bypass

Potential issues:
- `approved_by` is not a multi-level workflow.

---

## Table: asset_transfers

Purpose:
- User/location transfers.

Used by:
- `transferAssetAction`

Important fields:
- from/to user and location, `reason`, `transferred_at`
- `acknowledged_at`, `acknowledged_by` (column present; transfer action does not drive ack UI)

Related tables:
- `assets`, `users`, `locations`

RLS status:
- Tenant isolation + super-admin bypass

Potential issues:
- Ack columns unused in application flow.

---

## Table: audit_log

Purpose:
- Append-only company activity.

Used by:
- `writeAuditLog`, activity page

Important fields:
- `actor_id`, `action`, `entity_type`, `entity_id`, `old_values`, `new_values`, `ip_address`

Related tables:
- `companies`, `users`

Indexes:
- company_id, (entity_type, entity_id), created_at desc

RLS status:
- Tenant SELECT only. No INSERT/UPDATE/DELETE for `authenticated`. Writes via service role.

Potential issues:
- Many mutations never call `writeAuditLog` (asset CRUD, ticket update, audit scans, login).

---

## Table: company_invites

Purpose:
- Email invites with token.

Used by:
- Company create admin invite, team invite, vendor invite, accept page

Important fields:
- `email`, `role_id`, `token` unique, `expires_at` default 7 days, `accepted_at`, `vendor_id`

Related tables:
- `companies`, `roles`, `vendors`

RLS status:
- Tenant SELECT. Super-admin ALL. Writes via service role.

Potential issues:
- Token stored plaintext.

---

## Table: notifications

Purpose:
- In-app notification rows (storage thresholds).

Used by:
- Notification bell, `check_storage_thresholds`

Important fields:
- `type`, `title`, `message`, `severity`, `threshold_percent`, `read_at`, `emailed_at` (0019)

Related tables:
- `companies`

RLS status:
- Tenant SELECT. Super-admin ALL. No tenant INSERT.

Potential issues:
- Does not store custody/audit/email events (those use `notification_logs` / email only).

---

## Table: maintenance_tickets

Purpose:
- Work orders.

Used by:
- Maintenance admin, public QR report, PM scheduler, vendor RLS, reports

Important fields:
- `asset_id`, `status`, `title`, `description`, `reported_by`, `assigned_to`, `opened_at`, `resolved_at`
- Later: `vendor_id`, `priority`, `due_at`, `type_key`, `plan_id`, reporter name/email for public reports

Related tables:
- `assets`, `users`, `vendors`, `maintenance_plans`, `maintenance_types`

RLS status:
- 0038: tenant + vendor_id match for vendor users. Super-admin bypass remains.

Potential issues:
- No comments, attachments, cost, SLA columns.
- No delete.

---

## Table: maintenance_types

Purpose:
- Ticket type catalog (seeded).

Used by:
- Ticket create form (`getMaintenanceTypesForForm`)

Important fields:
- `key`, `name`, `is_system`, `is_active`

Related tables:
- Logical link to `maintenance_tickets.type_key` (not FK)

RLS status:
- Tenant isolation + super-admin bypass

Potential issues:
- No admin UI to edit types (`NOT_VERIFIED` if only seeded).

---

## Table: maintenance_plans

Purpose:
- Recurring PM.

Used by:
- Plans page, cron scheduler

Important fields:
- `asset_id`, `name`, `frequency`, `interval_days`, `next_due_at`, `assigned_to`, `vendor_id`, `is_active`

Related tables:
- `assets`, `maintenance_tickets.plan_id`

RLS status:
- Tenant isolation + super-admin bypass

Potential issues:
- Create exists; update/delete actions not found.

---

## Table: vendors

Purpose:
- Vendor master.

Used by:
- Vendors admin, ticket/plan/user/invite FKs

Important fields:
- `name` unique per company, contact fields, `service_category`, `is_active`, `notes`

Related tables:
- `users.vendor_id`, `assets.vendor_id`, tickets, plans, invites

RLS status:
- Full tenant read/write (vendors table itself is not vendor-user filtered)

Potential issues:
- Vendor users can read all vendor rows for the company if they can query the table.
- No delete; `vendors.delete` permission unused.

---

## Table: audits

Purpose:
- Physical inventory campaigns.

Used by:
- Audit admin, floor mode, tag verify

Important fields:
- `name`, `scheduled_date`, `location_id`, `location_name`, `status` draft/active/completed
- `started_at`, `completed_at`, `created_by`
- `require_photo_on_exception`, `require_remark_on_exception` (0040)

Related tables:
- `audit_items`, `locations`

RLS status:
- Tenant isolation + super-admin bypass (no vendor special case)

Potential issues:
- Photo-required flag unused at scan time.
- No assignee column.

---

## Table: audit_items

Purpose:
- Per-asset snapshot and scan result.

Used by:
- Scan, missing, resolve, exports

Important fields:
- Unique `(audit_id, asset_id)`
- expected/found location and condition
- `status` unverified/verified/exception
- `exception_types` text[]
- `notes`, `scanned_at`, `scanned_by`, resolution fields

Related tables:
- `audits`, `assets`

RLS status:
- Tenant isolation + super-admin bypass

Potential issues:
- Re-scan updates the same row (no duplicate-scan rejection).
- `wrong_custodian` not auto-computed.

---

## Table: audit_exception_types

Purpose:
- Seeded exception catalog.

Used by:
- Seed data; TypeScript `AUDIT_EXCEPTION_TYPES` is the runtime list

Important fields:
- `key`, `name`, `is_system`, `is_active`

Related tables:
- Logical only (`audit_items.exception_types`)

RLS status:
- Tenant isolation + super-admin bypass

Potential issues:
- Table exists but is not used as the source of truth in UI (hardcoded keys). No admin editor.

---

## Table: document_types

Purpose:
- Attachment type catalog.

Used by:
- Attachment uploader, category required-doc checkboxes

Important fields:
- `key`, `name`, `is_system`

Related tables:
- Logical: `asset_documents.document_type`, `category_required_documents.document_type_key`

RLS status:
- Tenant isolation + super-admin bypass

Potential issues:
- No admin editor for custom types.

---

## Table: category_required_documents

Purpose:
- Which document types a category should have.

Used by:
- Category create/update UI and queries/mutations

Important fields:
- PK `(category_id, document_type_key)`, `company_id`

Related tables:
- `asset_categories`

RLS status:
- Tenant isolation + super-admin bypass

Potential issues:
- Not enforced when uploading/creating assets. UI/DB without runtime gate.

---

## Table: import_jobs

Purpose:
- Asset CSV import history.

Used by:
- Reports admin import

Important fields:
- `status`, `total_rows`, `success_count`, `error_count`, `error_report`, `created_by`

Related tables:
- `companies`, `users`

RLS status:
- Tenant isolation + super-admin bypass

Potential issues:
- No rollback. Status default `completed`.

---

## Table: email_templates

Purpose:
- Per-company Brevo-bound templates.

Used by:
- Notifications admin, `dispatchEventEmail`

Important fields:
- Unique `(company_id, event_key)`
- `subject`, `html_body`, `text_body`, `is_enabled`

Related tables:
- `companies`

RLS status:
- Tenant isolation + super-admin bypass (authenticated can write templates)

Potential issues:
- Any user with DB access via a leaked client could edit templates; app gates with `notifications.edit`.

---

## Table: notification_rules

Purpose:
- Reminder offsets.

Used by:
- Notifications admin toggle, email scheduler, seed in 0039/0041

Important fields:
- Unique `(company_id, event_key, offset_days, recipient)`
- `is_enabled`

Related tables:
- `companies`

RLS status:
- Tenant isolation + super-admin bypass

Potential issues:
- `recipient` is essentially `admins` only.

---

## Table: notification_logs

Purpose:
- Email send idempotency and log.

Used by:
- Dispatch, notifications admin list, scheduler

Important fields:
- Unique `(company_id, event_key, occurrence_key, recipient_email)`
- `status`, `error`, `sent_at`, `entity_id`

Related tables:
- `companies`

RLS status:
- Tenant SELECT. Super-admin ALL. Inserts via service role in dispatch.

Potential issues:
- Unique key prevents retry of failed sends for the same occurrence.

---

## Table: billing_plans

Purpose:
- Platform pricing.

Used by:
- Public signup, admin plans, quota

Important fields:
- `name`, `price_monthly`, `currency`, `asset_limit`, extra pack fields, `is_active`, `sort_order`
- `razorpay_plan_id` (0033)

Related tables:
- `company_subscriptions`, `billing_orders`

RLS status:
- Anon/auth SELECT where `is_active`. Super-admin ALL.

Potential issues:
- None found.

---

## Table: company_subscriptions

Purpose:
- Tenant plan + extras + Razorpay ids.

Used by:
- Quota, signup payment, webhooks, admin assign

Important fields:
- Unique `company_id`
- `plan_id`, `extra_assets`, `status`
- Razorpay customer/subscription ids, payment confirm token (0033)

Related tables:
- `companies`, `billing_plans`

RLS status:
- Tenant SELECT. Super-admin ALL.

Potential issues:
- Halted/canceled does not block login in application code.

---

## Table: billing_orders

Purpose:
- Extra-asset pack orders.

Used by:
- Tenant request, admin fulfill/cancel, Razorpay order confirm

Important fields:
- `packs`, `asset_quantity`, `amount`, `status` pending/fulfilled/canceled, `razorpay_order_id`

Related tables:
- `companies`, `billing_plans`

RLS status:
- Tenant SELECT. Super-admin ALL (orders also have tenant insert via service role)

Potential issues:
- None found in schema.

---

## Table: razorpay_webhook_events

Purpose:
- Webhook idempotency.

Used by:
- `handleRazorpayWebhookAction` / payments module

Important fields:
- Event id / payload / processed flags (see 0033)

Related tables:
- None required

RLS status:
- Service-role oriented (`NOT_VERIFIED` if authenticated policies exist)

Potential issues:
- None found.

---

## Table: crm_leads

Purpose:
- Marketing inquire form.

Used by:
- `submitLeadAction`, `/admin/leads`

Important fields:
- Contact fields, status, notes (see 0034)

Related tables:
- None (platform-wide, no `company_id`)

RLS status:
- Super-admin manage; public insert via service role in action

Potential issues:
- Not tenant data.

---

## Functions (application-relevant)

| Function | Purpose | Used by |
| --- | --- | --- |
| `is_super_admin()` | RLS / middleware | All bypass policies |
| `current_company_id()` | Tenant RLS | Most tables |
| `current_vendor_id()` | Vendor RLS | assets, maintenance_tickets |
| `increment_asset_sequence` | Asset codes | create asset |
| `adjust_storage_used` | Storage counter | uploads/deletes |
| `check_storage_thresholds` | In-app storage alerts | pg_cron |
| `get_asset_counts_by_category` | Dashboard | dashboard page |
| `get_asset_counts_by_status` | Dashboard | dashboard page |
| `set_updated_at()` | timestamps | triggers |

---

## Indexes (notable)

- Unique: companies.slug, users lower(email), assets (company_id, asset_code), invites.token, vendors (company_id, name), many `(company_id, key)` catalogs
- Lookup: audit_log entity + created_at, notification_logs company+sent_at, custody tables by asset_id
- Billing: subscriptions.plan_id, orders company/status

---

## Migrations reviewed (41)

0001 extensions · 0002 platform admins · 0003 companies · 0004 reserved slugs · 0005 roles (later altered) · 0006 users · 0007 company_settings · 0008 categories · 0009 locations · 0010 assets · 0011 asset_documents · 0012 audit_log · 0013 branding · 0014 dedicated infra · 0015 tickets · 0016 dashboard RPCs · 0017 asset redesign · 0018 storage/notifications/pg_cron · 0019 notifications emailed_at · 0020 reserved password/invite slugs · 0021 permissions jsonb · 0022 invites · 0023 statuses · 0024 backfill role permissions · 0025 notifications mark read · 0026 public tags · 0027 qr_generated · 0028 category_fields · 0029 audits · 0030 audit location name · 0031 location hierarchy + location history · 0032 billing · 0033 razorpay · 0034 crm · 0035 reserved floor · 0036 platform controls · 0037 custody · 0038 vendors/PM · 0039 email engine · 0040 reports/docs · 0041 document expiry rules

---

## Tables that exist but are weakly used

- `audit_exception_types` — seeded; UI uses hardcoded TypeScript keys
- `maintenance_types` — seeded and read for ticket type; no editor
- `document_types` — seeded and read; no editor
- `companies.is_dedicated_infra` — admin checkbox only
- `asset_transfers.acknowledged_*` — columns without UI
- `audits.require_photo_on_exception` — stored, not enforced
- `assets.vendor_id` — RLS, not bound to purchase form
- `category_required_documents` — saved in category form, not enforced on assets

## Features in UI that lack full database support

- Excel `.xlsx` option — no binary xlsx, generated XML string
- Module disable — flags exist; page-level enforcement incomplete (not a missing table)
- Approval workflows — no workflow tables
- Departments, tags, NFC, contracts, ticket comments — no tables

## Database fields not connected to forms

- `assets.vendor_id` (purchase uses `assets.vendor` text)
- `asset_transfers.acknowledged_at` / `acknowledged_by`
- `audits.require_photo_on_exception` (checkbox writes it; scan ignores it)
- `users.is_active` (UI writes it; login ignores it)
- `companies.is_dedicated_infra` (admin only; no runtime)
- Possible reporter extra columns on tickets used by public report, not full ticket edit form
