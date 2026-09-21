# TagX Platform Overview

TagX is Mulsetu’s multi-tenant **Smart QR Asset Management** SaaS.  
Production site: [tagx.mulsetu.com](https://tagx.mulsetu.com)

This document explains **which dashboards exist**, **what each one can do**, and **what is dynamic** (plans, modules, roles, branding, billing).

---

## 1. Big picture

TagX has **three kinds of people** and **three app shells**:

| Who | How they are identified | Where they work |
| --- | --- | --- |
| **Platform Admin** (Mulsetu / TagX staff) | Row in `platform_admins` | `/admin` — top header nav |
| **Company users** (tenant employees) | Row in `users` with `company_id` + role | `/dashboard`, `/assets`, … — **left sidebar** |
| **Public / anonymous** | No login | Marketing, `/tag/[id]`, lead forms |

```text
Public marketing  →  Signup / Onboarding  →  Company workspace (sidebar)
                                           ↗
Platform Admin (/admin header) ─────────── creates companies, plans, payments
```

**Important UI difference**

- **Platform Admin** uses a **header** menu (Companies, Leads, Plans, …). That is by design — a small Mulsetu control panel.
- **Company workspaces** use a **sidebar** (Dashboard, Assets, Administration, …).

---

## 2. Login doors (three entrances)

| Door | URL | Who |
| --- | --- | --- |
| Workspace picker | `/login` | Enter company slug → `/{slug}/login` |
| Company login | `/{slug}/login` | Tenant users only (must belong to that company) |
| Platform Admin | `/admin/login` | Only users in `platform_admins` |

Password reset and invite accept:

- `/reset-password`, `/{slug}/forgot-password`, `/admin/forgot-password`
- `/invite/[token]` — set password after invite
- `/auth/callback` — email confirmation

---

## 3. Platform Admin dashboard (`/admin`)

**Shell:** top header (no sidebar)  
**Access:** `admin@…` (or any Auth user) **plus** a row in `public.platform_admins`  
**Layout file:** `src/app/(admin)/admin/(protected)/layout.tsx`

### Features by page

| Nav item | Route | What it does |
| --- | --- | --- |
| **Companies** | `/admin` | List all tenants. Edit, assign plan, set subscription status, grant extra assets, suspend/delete. |
| **New company** | `/admin/companies/new` | Provision a workspace: company + admin invite + optional plan/payment. |
| **Leads** | `/admin/leads` | CRM for Demo / Inquire submissions from the public site. |
| **Plans** | `/admin/plans` | Create/edit pricing plans (price, asset/user/storage limits, included modules). |
| **Asset orders** | `/admin/orders` | Fulfill or cancel tenant requests for extra asset packs. |
| **Payments** | `/admin/payments` | View / record payments (online Razorpay + offline/manual). |
| **Storage usage** | `/admin/storage` | Per-company R2 storage usage vs limits. |

Platform Admin can also bypass many tenant RLS checks via `is_super_admin()`, but day-to-day Mulsetu work is meant to stay in `/admin`.

---

## 4. Company (tenant) dashboard — sidebar app

**Shell:** left sidebar + top bar + company branding  
**Access:** logged-in user with a `company_id`, email confirmed, company not suspended  
**Layout:** `src/app/(dashboard)/layout.tsx`  
**Sidebar:** `src/components/layout/app-sidebar.tsx`

Nav items appear only when **both** are true:

1. The user’s **role permissions** allow it, and  
2. The company’s **enabled feature modules** (from plan ∩ company settings) include it.

### Sidebar features

| Menu | Route(s) | Purpose |
| --- | --- | --- |
| **Dashboard** | `/dashboard` | Overview widgets (hidden for vendor users). |
| **Assets** | `/assets`, `/assets/new`, `/assets/[id]` | Asset register, create/edit, documents, QR tags, lifecycle fields. Vendors see “Assigned assets”. |
| **Administration** (group) | under `/dashboard/administration/…` | Users & Roles, Categories, Locations, Statuses, Conditions, Asset fields, Settings subsections — filtered by permission. |
| **Vendors** | `/dashboard/administration/vendors` | Vendor directory (module `vendors`). |
| **Maintenance** | `/dashboard/administration/maintenance`, `…/plans` | Tickets + preventive maintenance plans. |
| **Floor audit** | `/floor/audits` | Mobile-friendly QR scan audits (separate floor shell). |
| **Audits** | `/dashboard/administration/audits` | Desk-side audit campaigns. |
| **Reports** | `/dashboard/administration/reports` | Reports / export / import (module `reports`). |
| **Settings** | `/dashboard/administration/settings` | Branding, modules, billing, dashboard layout, workflows. |

Other admin pages (when entitled): Notifications, Activity, Conditions, Asset fields, PM plans.

### Floor shell (`/floor`)

Separate mobile-first UI for walking audits:

- `/floor` → `/floor/audits`
- `/floor/audits/[id]` — scan `/tag/…` or asset codes with camera

Requires module **audits** + `audits.view`.

---

## 5. Public surfaces

| Page | Route | Purpose |
| --- | --- | --- |
| Landing | `/` | Product, pricing (live plans), CTAs |
| SEO | `/asset-management-system` | Ranking content |
| Demo / Inquire | `/demo`, `/inquire` | Lead forms → Platform Admin CRM |
| Signup | `/signup` → `/signup/check-email` | Create Auth account |
| Onboarding | `/onboarding` | Logged-in user **without** a company creates workspace + picks plan |
| Public QR tag | `/tag/[id]` | Scan target: asset card, anonymous report; auditors can verify into an open audit |

---

## 6. What is dynamic (and who controls it)

TagX is designed so Mulsetu and each company can change behavior **without code deploys**.

### A. Controlled by Platform Admin (Mulsetu)

| Dynamic piece | Stored in | UI |
| --- | --- | --- |
| Pricing plans (₹, asset cap, user/storage limits, included modules) | `billing_plans` | `/admin/plans` |
| Which plan a company is on + subscription status | `company_subscriptions` | Companies dialog |
| Extra assets granted | company / subscription fields | Companies / orders |
| Offline / manual payments | `billing_payments` | `/admin/payments` |
| Lead pipeline | CRM tables | `/admin/leads` |
| Suspend a company | `companies.suspended_at` | Companies |
| Storage quotas (via plan apply) | company settings limits | Plans + storage page |

### B. Controlled by Company Admin (tenant)

| Dynamic piece | Stored in | UI |
| --- | --- | --- |
| Branding (name, logo, colors, slug) | `companies` | Settings |
| Enabled modules (within plan allowance) | `company_settings.enabled_modules` | Settings → modules |
| Roles & permission matrix | `roles.permissions` | Administration → Roles |
| Users & invites | `users`, invites | Administration → Users |
| Categories, locations, statuses, conditions | tenant catalog tables | Administration |
| Custom asset fields | field config | Administration → Fields |
| Dashboard widgets / layouts per role | `company_settings` | Settings → dashboard |
| Workflow flags (approvals, etc.) | `workflow_config` / settings | Settings |
| Departments, disposal methods | catalogs on settings | Settings |
| Buy extra assets / pay plan | billing actions + Razorpay | Settings → billing |

### C. Feature modules (plan ∩ company)

Catalog (`src/lib/permissions/feature-catalog.ts`):

`assets`, `qr`, `audits`, `lifecycle`, `handover`, `transfers`, `maintenance`, `preventive_maintenance`, `documents`, `vendors`, `reports`, `email`, `approvals`, `departments`, `custom_fields`, `disposal`, `financial`

- Plan defines **what is allowed**.  
- Company Settings can turn modules **off** (cannot turn on beyond the plan).  
- Sidebar and pages hide features that are off.

### D. Permissions (role matrix)

Modules: assets, categories, locations, statuses, maintenance, users, roles, audits, notifications, settings, vendors, handover, reports.  
Actions: view, create, edit, delete, assign, export, import, approve, transfer, return, dispose, resolve, configure, manage.

- **Company Admin** (`users.is_company_admin`) bypasses the role matrix inside the company.  
- Still limited by **plan modules** and **writable subscription** (read-only when unpaid / suspended).

### E. Asset QR (dynamic URL, not stored image)

1. On asset detail, **Generate QR** builds SVG in the browser for  
   `{origin}/tag/{assetId}`.
2. DB stores only `assets.qr_generated_at` (+ `qr_events` history).  
3. SVG is **not** uploaded to R2; it is regenerated anytime from the same URL.

---

## 7. End-to-end flows

### Self-serve signup

1. Visitor picks a plan on `/` or `/signup?plan=…`  
2. Creates Auth account → confirm email  
3. `/onboarding` → create company + subscription → Razorpay if paid  
4. Lands in `/dashboard` as Company Admin  

### Sales-assisted (Platform Admin)

1. `/admin/companies/new` → company + optional plan/payment  
2. Invite email → `/invite/[token]` → password  
3. Login at `/{slug}/login`  

### Billing after go-live

- **Active** subscription → full write access  
- **pending_payment / past_due / halted / canceled / expired / suspended** → tenant becomes **read-only** (banner; mutations blocked except billing/settings paths)  
- Extra assets: tenant requests pack → appears in `/admin/orders` → Platform Admin fulfills  

### Physical audit

1. Create audit in desk UI  
2. Open **Floor audit** → scan QR codes  
3. Results sync to audit campaign  

---

## 8. Data & security model (short)

- **Multi-tenant:** almost every business table has `company_id`.  
- **RLS** on all tables; `is_super_admin()` and `current_company_id()` helpers.  
- **Architecture rule:** UI → `modules/*/actions.ts` → queries/mutations → DB (no direct Supabase from `app/` / `components/`).  
- **Files:** Cloudflare R2 (type/size checked server-side).  
- **Email:** Brevo. **Payments:** Razorpay (+ manual offline in admin).  

---

## 9. Quick “where do I…?” map

| I want to… | Go to |
| --- | --- |
| Run TagX as Mulsetu | `/admin/login` → `/admin` |
| Change plan prices / asset caps | `/admin/plans` |
| Onboard a client by hand | `/admin/companies/new` |
| See Demo/Inquire leads | `/admin/leads` |
| Work inside a client company | `/{slug}/login` → `/dashboard` |
| Turn features on/off for my company | Settings → modules |
| Control who can edit assets | Administration → Roles |
| Generate printable QR | Assets → asset detail → Generate QR |
| Scan assets on the floor | Floor audit |
| Public scan page (no login) | `/tag/{assetId}` |

---

## 10. Related code pointers

| Area | Path |
| --- | --- |
| Platform Admin layout | `src/app/(admin)/admin/(protected)/layout.tsx` |
| Tenant sidebar | `src/components/layout/app-sidebar.tsx` |
| Middleware / access gates | `src/middleware.ts` |
| Permissions | `src/lib/permissions/` |
| Feature modules | `src/lib/permissions/feature-catalog.ts` |
| Super admin check | `src/lib/permissions/super-admin.ts` |
| Billing | `src/modules/billing/` |
| Companies / provision | `src/modules/companies/` |
| Platform admins table | `supabase/migrations/0002_platform_admins_and_helpers.sql` |
| Onboarding / payments schema | `supabase/migrations/0047_onboarding_and_payments.sql` |

---

*Living overview of the current TagX codebase. Product UI labels may evolve; routes and tables above match the implementation as of this document.*
