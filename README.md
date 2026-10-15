# TagX — Project Implementation Guide

TagX is Mulsetu's multi-tenant **Smart QR Asset Management** SaaS. Each customer company gets its own white-labeled workspace in which to register assets, tag them with QR codes, track custody, run physical audits, and manage maintenance.

- Production: [tagx.mulsetu.com](https://tagx.mulsetu.com)
- Feature list (for customers and stakeholders): [FEATURES.md](./FEATURES.md)
- Coding rules for contributors and AI assistants: [CLAUDE.md](./CLAUDE.md)

---

## 1. Technology stack

| Layer | Technology |
| --- | --- |
| Framework | Next.js 14 (App Router), React 18 |
| Language | TypeScript (`strict`, `noUncheckedIndexedAccess`) |
| UI | Tailwind CSS, shadcn/ui (Radix primitives), lucide icons, Recharts |
| Database / Auth | Supabase: Postgres, Auth, Row Level Security (RLS) |
| File storage | Cloudflare R2 (S3 API via `@aws-sdk/client-s3`) |
| Email | Brevo (transactional) |
| Payments | Razorpay (subscriptions, one-off orders, webhooks) |
| Validation | zod |
| Documents | `exceljs` (Excel export), `pdf-lib` (QR label sheets), `qrcode` (QR SVG) |
| Tests | Vitest |
| Hosting | Vercel (including the daily cron job) |

---

## 2. Getting started

### Prerequisites

- Node.js 20+
- A Supabase project (or the local Supabase CLI stack)
- A Cloudflare R2 bucket, a Brevo account, and Razorpay keys (test mode works for development)

### Setup

```bash
npm install
cp .env.example .env.local   # then fill in the values (see below)
npm run dev                  # http://localhost:3000
```

### Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and serve |
| `npm run lint` | ESLint, including the architecture import rules |
| `npm test` / `npm run test:watch` | Vitest |
| `node scripts/verify-migrations.mjs` | Checks the migrations against the configured database |

### Environment variables

| Variable | Used for |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase client (browser + server) |
| `SUPABASE_SECRET_KEY` | Server-only admin client (service role) |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL` | File storage |
| `BREVO_API_KEY`, `BREVO_FROM_EMAIL`, `BREVO_FROM_NAME` | Transactional email |
| `CRM_NOTIFY_EMAIL` | Optional inbox for demo/inquire leads (defaults to `BREVO_FROM_EMAIL`) |
| `NEXT_PUBLIC_APP_URL` | Absolute links in emails, invites, and QR codes |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | Payments |
| `CRON_SECRET` | Bearer token for `/api/cron/notifications`. If it is missing, the endpoint returns 401. |
| `SEND_REAL_EMAILS_IN_DEV` | Optional. Sends real emails from a development build. |

Razorpay webhook URL: `https://<domain>/api/razorpay/webhook`. Subscribe it to the events `payment.captured`, `order.paid`, `subscription.activated`, `subscription.charged`, `subscription.pending`, `subscription.halted` and `subscription.cancelled`.

### Switching Razorpay from test to live

Paid plans renew by automatic **card** debit (Razorpay Subscriptions). The checkout shows only the card option.

1. In the Razorpay Dashboard, finish KYC/activation and make sure **Subscriptions** is enabled for the live account. Under Payment Methods, turn off everything except cards, so the restriction also holds outside TagX's checkout.
2. Switch the Dashboard to **Live mode** → Account & Settings → API Keys → generate a key pair (`rzp_live_…`).
3. Live mode → Webhooks → add `https://<domain>/api/razorpay/webhook` with the events listed above and a **new** secret.
4. In Vercel (Production environment), replace `NEXT_PUBLIC_RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET`, then **redeploy**. `NEXT_PUBLIC_*` values are baked in at build time, so a redeploy is required.
5. Clear the test-mode plan IDs. Razorpay plans exist in only one mode, and TagX recreates a missing plan automatically on its next checkout:
   ```sql
   update public.billing_plans set razorpay_plan_id = null;
   ```
   Any company that subscribed in test mode still points at a test subscription. Reset it, or re-create the company.

### Database

The schema lives entirely in `supabase/migrations` (54 migrations, `0001`–`0054`). Apply them in order with the Supabase CLI (`supabase db push`) or the dashboard SQL editor. Never change the schema by hand in production. Every change gets a new migration.

---

## 3. Architecture

### Layering (Model → Controller → View)

> **View (`app/`, `components/`) → Controller (`modules/*/actions.ts`) → Model (`modules/*/queries.ts` + `mutations.ts`) → Database. Dependencies point in one direction only.**

| Layer | Files | Responsibility |
| --- | --- | --- |
| **View** | `src/app/**`, `src/components/**` | Pages, layouts, route handlers, components. Calls actions and renders the results. Never imports Supabase. |
| **Controller** | `src/modules/<domain>/actions.ts` | Validates input (zod), checks permissions and feature modules, rate-limits writes, then calls the Model. Returns plain serializable results. This is the module's only public surface. |
| **Model** | `src/modules/<domain>/queries.ts`, `mutations.ts` | The only code allowed to talk to Supabase or R2. Knows tables and columns. Knows nothing about HTTP, React, or authorization. |

ESLint enforces this rule with `no-restricted-imports` in `.eslintrc.json`. Any `@supabase/*` import under `src/app/**` or `src/components/**` is a lint error. The rule exists for three reasons:

- **Testability.** Actions and queries can be tested separately.
- **Swappability.** Nothing outside `modules/` knows that Supabase exists.
- **Authorization cannot be skipped by accident.** Every data path goes through an action that checks permissions.

### Module pattern

Every domain lives in `src/modules/<domain>/` and contains five files: `queries.ts`, `mutations.ts`, `actions.ts`, `validation.ts`, and `types.ts`.

Current modules: `activity`, `assets`, `audits`, `billing`, `categories`, `companies`, `conditions`, `crm`, `custody`, `email`, `locations`, `maintenance`, `reports`, `roles`, `statuses`, `storage`, `users`, `vendors`.

### Folder map

```
src/
  app/
    (admin)/admin/...        Platform Admin (Mulsetu staff), header nav
    (dashboard)/             Tenant workspace, sidebar nav
      dashboard/             Home + /dashboard/administration/** (all admin pages)
      assets/                Asset register, create, detail
      floor/                 Mobile floor-audit shell
    (tenant)/[slug]/         Per-company login and forgot-password
    api/                     cron/notifications, media/[...key], razorpay/webhook
    tag/[id]/                Public QR scan page
    signup/, onboarding/, invite/[token]/, reset-password/, auth/confirm/
    page.tsx, demo/, inquire/, asset-management-system/   Marketing site
  components/
    ui/                      shadcn/ui primitives
    assets/, audits/, dashboard/, layout/, marketing/ ...
  modules/                   Domain modules (Model + Controller)
  lib/
    supabase/                Client factories (browser / server / admin)
    permissions/             RBAC, feature modules, tenant access, super admin
    rate-limit.ts            In-process rate limiter
  middleware.ts              Session refresh, tenant / suspension / active-user gates
supabase/migrations/         SQL migrations (schema source of truth)
scripts/                     Maintenance scripts
```

---

## 4. Multi-tenancy and security model

### Tenancy

- Every tenant-owned table has a `company_id` column.
- **RLS is enabled on every table.** Policies call the helpers `current_company_id()` (resolved from the signed-in user's `users` row), `is_super_admin()`, `current_vendor_id()`, and `current_user_has_permission(module, action)`.
- A new table ships with its RLS policy in the same migration that creates it.
- `company_id` and `role` are always derived from the server-side session. Values supplied by the client are never trusted.

### Three kinds of user

| Who | Identified by | Works in |
| --- | --- | --- |
| Platform Admin (Mulsetu staff) | Row in `platform_admins` | `/admin` (header navigation) |
| Company user | Row in `users` with `company_id` + `role_id` | `/dashboard`, `/assets`, `/floor` (sidebar) |
| Public / anonymous | No login | Marketing pages, `/tag/[id]`, lead forms |

### Access gates (in order)

1. **Middleware** (`src/middleware.ts`) refreshes the Supabase session and blocks the user if they are deactivated (`users.is_active`), their company is suspended (`companies.suspended_at`), or they are signed in to the wrong tenant.
2. **Feature modules.** The plan's `included_modules` are intersected with the company's `enabled_modules`, and `requireModule()` checks the result. The catalog lives in `src/lib/permissions/feature-catalog.ts`.
3. **Role permissions.** `requirePermission(module, action)` checks against `roles.permissions` (jsonb). The taxonomy is in `src/lib/permissions/taxonomy.ts`. The Company Admin (`users.is_company_admin`, one per company) bypasses the role matrix but is still limited by plan modules.
4. **Subscription state.** If the subscription is not `active`, the workspace becomes read-only. Only billing and settings paths can still write.
5. **RLS** in Postgres is the final backstop.

### Other security rules

- All input is validated with zod in `modules/*/validation.ts` before it reaches the Model.
- Queries are always parameterized. SQL is never built with strings.
- **R2 uploads:** the server checks file type against an allow-list and checks file size. Object keys are prefixed `companies/{company_id}/` and use UUID filenames. Files are served through `/api/media/[...key]`.
- **Rate limits** (`src/lib/rate-limit.ts`) cover login, admin login, signup, password reset, lead forms, test emails, and mutating actions. The limiter is in-process, so a multi-instance deployment needs a shared store such as Redis.
- **Invite tokens** are stored hashed (`token_hash`) and expire after 7 days.
- **Cron** requires `Authorization: Bearer $CRON_SECRET`. The Razorpay webhook is signature-verified, and processed events are stored for idempotency.
- **Public tag page:** it shows only identification fields. Purchase, insurance, allotment, and document data are never shown.

---

## 5. Database overview

The main tables, grouped by area. Each table carries `company_id` unless it is platform-wide.

| Area | Tables |
| --- | --- |
| Platform | `platform_admins`, `reserved_slugs`, `billing_plans`, `crm_leads` |
| Tenant core | `companies`, `company_settings`, `users`, `roles`, `company_invites` |
| Catalogs | `asset_categories`, `category_fields`, `asset_statuses`, `asset_conditions`, `locations`, `document_types`, `category_required_documents`, `maintenance_types`, `audit_exception_types` |
| Assets | `assets`, `asset_documents`, `asset_location_history`, `qr_events` |
| Custody | `asset_handovers`, `asset_returns`, `asset_transfers`, `asset_lifecycle_events` |
| Maintenance | `maintenance_tickets`, `maintenance_plans`, `vendors` |
| Audits | `audits`, `audit_items` |
| Email | `email_templates`, `notification_rules`, `notification_logs`, `notifications` |
| Data | `import_jobs`, `audit_log` |
| Billing | `company_subscriptions`, `billing_orders`, `billing_payments`, `razorpay_webhook_events` |

Important functions include `current_company_id()`, `is_super_admin()`, `current_user_has_permission()`, `increment_asset_sequence()` (asset codes), `adjust_storage_used()`, `check_storage_thresholds()` (pg_cron), `set_user_active()`, `update_user_role()`, `transfer_company_admin()`, and `request_company_deletion()`.

### Asset record fields

The create/edit form at `/assets/new` and `/assets/[id]` groups the asset fields into four sections:

| Section | Fields |
| --- | --- |
| Basic | Name, image, asset code (manual or auto from `company_settings.asset_code_format`), category, location, status, CWIP invoice ID |
| Additional | Condition, brand, model, serial number, description, linked asset, tags, criticality, department, notes, attachments, category custom fields (`custom_fields` jsonb) |
| Purchase | Vendor, PO number, invoice date/number, purchase date, purchase price, ownership (owned / partner + partner name) |
| Custody and cover | Allotted to, allotment date, warranty start/end, AMC provider/start/end, insurance provider/policy/expiry |
| Financial (module `financial`) | Useful life, current book value, residual value |
| System | `id`, `company_id`, `created_by`, `created_at`, `updated_at`, `archived_at`, `deleted_at`, `qr_generated_at` |

If you change asset fields, update all of these together: the migration, `modules/assets/types.ts`, `modules/assets/validation.ts`, the form, and this table.

### QR tags

QR images are not stored. The asset detail page renders an SVG on the fly for `{NEXT_PUBLIC_APP_URL}/tag/{assetId}`. Only `assets.qr_generated_at` and the `qr_events` history are saved. Because the URL never changes, old stickers keep working. Printable label sheets are produced as PDFs with `pdf-lib`.

---

## 6. Routes

| Area | Routes |
| --- | --- |
| Marketing | `/`, `/asset-management-system`, `/demo`, `/inquire` |
| Sign-up / auth | `/signup`, `/signup/check-email`, `/onboarding`, `/login` (workspace picker), `/{slug}/login`, `/{slug}/forgot-password`, `/reset-password`, `/auth/confirm`, `/invite/[token]` |
| Public QR | `/tag/[id]` |
| Workspace | `/dashboard`, `/assets`, `/assets/new`, `/assets/[id]` |
| Administration | `/dashboard/administration/` + `users`, `roles`, `vendors`, `categories`, `conditions`, `statuses`, `fields`, `locations`, `maintenance`, `maintenance/plans`, `audits`, `audits/[id]`, `reports`, `notifications`, `activity`, `invoices/[id]`, `settings` (`workspace`, `branding`, `modules`, `dashboard`, `billing`, `data`) |
| Floor audits | `/floor`, `/floor/audits`, `/floor/audits/[id]` |
| Platform Admin | `/admin/login`, `/admin/forgot-password`, `/admin` (companies), `/admin/companies/new`, `/admin/leads`, `/admin/plans`, `/admin/orders`, `/admin/payments`, `/admin/storage` |
| API | `/api/cron/notifications`, `/api/media/[...key]`, `/api/razorpay/webhook` |

---

## 7. Background jobs

| Job | Schedule | What it does |
| --- | --- | --- |
| Vercel cron → `/api/cron/notifications` | Daily 06:00 UTC (`vercel.json`) | Creates tickets from due preventive-maintenance plans and sends reminder emails (warranty, AMC, insurance, document expiry, maintenance due) according to `notification_rules` |
| Supabase `pg_cron` → `check_storage_thresholds()` | Database schedule | In-app notifications when a company nears its storage limit |

---

## 8. Business flows (implementation view)

- **Self-serve signup:** `/signup` → confirm email → `/onboarding` creates the company, settings, Admin role, first user, and default catalogs → Razorpay checkout for paid plans → `/dashboard`.
- **Sales-assisted signup:** `/admin/companies/new` → invite email → `/invite/[token]` → `/{slug}/login`.
- **Billing:** subscription status is driven by Razorpay webhooks. Extra asset packs are requested in Settings → Billing and fulfilled in `/admin/orders`. Offline payments are recorded in `/admin/payments`.
- **Physical audit:** create a campaign, which snapshots the in-scope assets into `audit_items` → start it → scan on `/floor/audits/[id]` or `/tag/[id]` → resolve exceptions or raise maintenance tickets from them → complete → export.

---

## 9. Conventions

- Server Components are the default. Add `"use client"` only for interactivity, state, or browser APIs.
- Use `next/image` for images. Paginate every list that can exceed 50 rows.
- No `any` (use `unknown` and narrow it), and no unused exports.
- Write commit messages in the conventional style (`feat(scope): …`, `fix: …`).

---

## 10. Deployment

1. Push to `main`. Vercel builds and deploys automatically.
2. Set every environment variable from section 2 in Vercel.
3. Apply any new migrations to the production Supabase project **before** the deploy that depends on them.
4. Point the Razorpay webhook at the production domain and set `CRON_SECRET`.

---

## 11. Known gaps and roadmap

These are the main items not yet built. [FEATURES.md](./FEATURES.md) has the customer-facing version.

- **Security:** shared (Redis) rate limiting for multi-instance deploys, 2FA/SSO, time-limited signed R2 URLs instead of the public media proxy.
- **Assets:** bulk edit/assign, accessory master data, barcode (Code128/EAN) and NFC/RFID fields.
- **Workflows:** asset requests and procurement, approval chains beyond transfer acceptance, employee offboarding.
- **Maintenance:** ticket comments, attachments, costs, SLA/escalation.
- **Audits:** auditor assignment, category/custodian/selected-asset scopes, campaign comparison, audit certificates.
- **Vendors:** contracts, AMC/warranty records linked to vendors, performance and rating.
- **Documents:** versioning, approval, vendor/employee documents.
- **Reporting:** PDF reports, scheduled report emails, Excel import, location/user/vendor import.
- **Enterprise:** public API and webhooks, WhatsApp/SMS, offline PWA, ERP/HRMS integrations.
