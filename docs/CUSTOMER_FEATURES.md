# TagX — features we give the customer

TagX is Mulsetu's **asset management system**. Each customer gets a private, white-labeled workspace. Their team tracks, scans, and manages equipment instead of keeping it in a spreadsheet.

This list is what a paying organization actually gets inside TagX.

---

## Workspace and brand

- **Own company workspace.** Unique slug (for example `acme`). The team signs in at `/acme/login`.
- **White-label.** Company name, logo, and brand colors on login, sidebar, and printed/scanned tag pages.
- **Isolated data.** Every record is scoped to that company. Other tenants cannot see it.
- **Self-serve signup.** Pick a plan, create the workspace, pay with Razorpay, start tagging.

---

## Asset register

The core product: a live register of every tagged unit.

- Create, edit, list, filter, and delete assets (paginated).
- **Asset code** typed by hand or auto-generated from the company's format.
- Photo on the asset, plus **file attachments** (invoices, manuals, certificates).
- **Categories** the customer defines (IT, plant, furniture, biomedical, and so on).
- **Custom fields per category** so each type of asset can carry the extra data that type needs.
- **Statuses** the customer defines (in use, in repair, retired, and so on).
- Condition, brand, model, serial number, description.
- Link one asset to another (parent / related unit).
- Purchase record: vendor, PO, invoice, dates, price.
- Ownership: owned by the company or held by a partner.
- Allotment: who the asset is issued to, and when.
- **Warranty, AMC, and insurance** dates and providers on the same record.
- **Location history** — every move is kept, not overwritten.

---

## QR tags (scan to open)

- Generate a **QR tag** for each asset.
- Anyone who scans it opens the **public tag page** for that unit (company branding, key details).
- Signed-in staff can jump from the tag into the full asset record.
- People on the floor can **report a problem** from the tag without a full login.
- During a live audit, scanning the tag **verifies** that the unit was found.

---

## Locations

- Hierarchy: **site → building → floor → room / zone**.
- Address fields on sites.
- Assets sit on a location. Moving them updates the register and the history.

---

## Maintenance

- Raise a **ticket on the asset** (not in email).
- Statuses: open, in progress, resolved, cancelled.
- Assign to a team member.
- Dashboard chart of open tickets.
- Reminders when a ticket stays open too long, and when warranty / AMC / insurance is due.

---

## Physical audits

- Plan an audit for a location and date (draft → active → completed).
- Walk the floor and **scan tags** to mark items verified.
- Flag exceptions: **missing**, **wrong location**, **condition mismatch**.
- Progress: how many verified vs still unverified.
- **Phone floor mode** at `/floor/audits`. Employees sign in on the phone, open an active audit, and scan stickers with the Camera app (or in-page camera where the browser allows it). No native app required.

---

## Team, roles, and access

- Invite users by email.
- **Roles** with a permission matrix: view / create / edit / delete per area (assets, locations, maintenance, audits, users, settings, and so on).
- Admins, technicians, and auditors only see what their role allows.
- In-app **notification bell** (info, warning, critical).
- Password reset and per-company login.

---

## Dashboard

- Assets by category.
- Assets by status.
- Open maintenance tickets.

---

## Plans, limits, and billing

What the customer buys:

- **Monthly plan** priced in INR, sized by **how many assets** they need.
- **Extra asset packs** from Settings when they outgrow the cap (Razorpay).
- **File storage** on the plan (uploads go through TagX, not a random drive).
- Super admin can also assign a plan or grant extra assets offline.

---

## How they start (before the workspace)

Public site at **tagx.mulsetu.com**:

- Product and pricing pages.
- **Book a demo** — stored as a lead.
- **Inquire** — stored as a lead.
- Create a workspace and subscribe.

Those demo and inquire submissions land in Mulsetu's TagX CRM (`/admin/leads`). That CRM is for the TagX team, not for the customer's own staff.

---

## What this is not

TagX is not a generic inventory spreadsheet plugin. The customer gets **one workspace** where the tag, the record, the ticket, and the audit refer to the same asset, under their own brand.
