# TagX — Feature Guide

**TagX** is Mulsetu's Smart QR Asset Management platform. Each customer organization gets a private workspace under its own brand. In that workspace the team registers equipment, tags it with QR codes, tracks who holds it and where it is, runs physical audits, and manages maintenance, all in one place instead of a spreadsheet.

Website: tagx.mulsetu.com

---

## 1. Who uses TagX

| User | What they do |
| --- | --- |
| **Company Admin** | Owns the workspace. Sets up branding, users, roles, catalogs, and billing. Has full access within the plan. |
| **Staff (custom roles)** | Managers, technicians, auditors, and employees. Each sees only what their role allows. |
| **Vendors** | External service partners. They see only the maintenance tickets and assets assigned to them. |
| **Anyone with a phone** | Can scan an asset's QR sticker to view basic details and report a problem without logging in. |
| **Mulsetu Platform Admin** | Runs the platform: companies, plans, payments, leads, and storage. |

---

## 2. Workspace, branding and onboarding

- **Private company workspace** with its own address, for example `/acme/login`.
- **White-label branding.** The company name, logo, and brand colors appear on the login page, the app, the floor-audit screens, and the public QR tag page.
- **Complete data isolation.** Every record belongs to one company. No other customer can see it, and the database itself enforces this.
- **Self-serve signup.** Choose a plan, create the workspace, pay online with Razorpay, and start tagging right away.
- **Assisted onboarding.** Alternatively, Mulsetu can create the workspace for you and send the admin an invitation.
- **Configurable modules.** The Company Admin can switch individual features on or off within what the plan includes.
- **Asset code format.** Choose a pattern such as `AST-00001`, optionally prefixed by category.
- **Configurable dashboard.** Choose which widgets each role sees on its home screen.
- **Data and privacy controls.** Export the workspace data, or formally request deletion of the workspace.

---

## 3. Users, roles and access control

- **Invite team members by email.** Invitations expire after 7 days. If the email is not delivered, the admin can copy the invite link instead.
- **Custom roles** with a permission matrix: for each area of the product, choose which actions the role may perform.
  - Areas: assets, categories, locations, statuses, maintenance, users, roles, audits, notifications, settings, vendors, handover, reports.
  - Actions: view, create, edit, delete, assign, export, import, approve, transfer, return, dispose, resolve, configure, manage.
- **Built-in roles:** Admin and Vendor. Roles can be duplicated as a starting point.
- **One Company Admin per workspace.** The role can be transferred to another user.
- **Activate or deactivate users.** Deactivated users are signed out and cannot log back in.
- **Vendor accounts** linked to a vendor record. These users see only their own tickets and assets.
- **Secure login.** Each company has its own login page, password reset, protection against repeated login attempts, and automatic sign-out on the wrong workspace.
- **Activity log** of important administrative actions.

---

## 4. Asset register

The heart of TagX is a live register of every tagged item.

- **Create, view, edit, archive, restore, and delete assets.**
- **Asset code**, typed by hand or generated automatically.
- **Photo** of the asset plus **file attachments** (invoices, manuals, certificates, warranty cards, photos).
- **Categories** you define (IT, plant, furniture, biomedical, and so on), each with its own default status and condition.
- **Custom fields per category.** Each category can collect extra information: text, numbers, dates, dropdowns, checkboxes, email, URL, or phone.
- **Statuses and conditions** you define, with colors. Examples: in use, in repair, retired, disposed, lost; new, good, fair, poor.
- **Descriptive details:** brand, model, serial number, description, tags, criticality, department, notes.
- **Linked assets.** Relate one unit to another, such as a parent machine and its component.
- **Purchase record:** vendor, PO number, invoice number and date, purchase date, price, and ownership (owned or held by a partner).
- **Financial information** (optional module): useful life, current book value, residual value.
- **Warranty, AMC, and insurance** dates and providers on the same record, with automatic reminders.
- **Custodian.** Who the asset is issued to, and since when.
- **Full history.** Every location change and custody event is kept; nothing is overwritten.
- **Search, filter, and paginate.** Search by name or code. Filter by category, location (including all sub-locations), status, vendor, custodian, condition, warranty, AMC, documents, or archived.
- **Plan limits.** The register shows how many assets the plan allows. More can be added by buying extra asset packs.

---

## 5. QR tags

- **Generate a QR tag** for any asset and download it as an image.
- **Print label sheets.** Select several assets and download a print-ready PDF of their QR labels.
- **Public scan page.** Anyone who scans the sticker sees a branded page with the asset's key details. Purchase prices, insurance, and documents are never shown on this page.
- **Report a problem from the sticker.** Anyone on the floor can report an issue without logging in, and a maintenance ticket is created automatically.
- **Staff shortcut.** Signed-in staff can jump from the tag straight to the full asset record.
- **Audit verification.** During a live audit, scanning the tag marks the asset as found.
- **Stickers last.** The QR link never changes, so printed stickers keep working even if a tag is regenerated.

---

## 6. Locations

- **Location hierarchy:** Site → Building → Floor → Room / Zone.
- **Address details** on sites.
- **Moving an asset** updates the register and records the move in its location history.
- **Asset counts per location**, shown on the dashboard and in reports.

---

## 7. Custody: handover, return, transfer and disposal

- **Handover.** Issue an asset to an employee with a date, accessories, and notes. The employee receives an email.
- **Acknowledgement.** The employee confirms receipt in the app.
- **Return.** Record the return date, condition, damage remarks, missing accessories, and the inspection result.
- **Transfer.** Move an asset to another person and/or location with a reason. The receiver can **accept or reject** the transfer.
- **Disposal.** Record how and when an asset was disposed of, using company-defined disposal methods.
- **Timeline.** Each asset shows a complete lifecycle timeline of handovers, returns, transfers, moves, and disposal.

---

## 8. Maintenance

- **Maintenance tickets** raised against an asset, with title, description, priority (low, normal, high, emergency), type, due date, and estimated cost.
- **Ticket status:** open, in progress, resolved, cancelled.
- **Assignment** to a team member and/or an external vendor.
- **Tickets from many sources:** created by staff, reported by anyone through the QR sticker, or raised directly from an audit exception.
- **Preventive maintenance plans.** Set up recurring service (for example every 3 months) and TagX creates the ticket automatically when it falls due.
- **Reminders** for upcoming and overdue maintenance.
- **Dashboard tile and report** for overdue tickets.

---

## 9. Physical audits

- **Audit campaigns.** Plan an audit for one location (including everything beneath it) or for the whole company, on a chosen date. Campaigns move from draft to active to completed.
- **Snapshot.** When the audit is created, TagX records where each asset should be and what condition it should be in.
- **Phone floor mode.** Staff open the audit on their phone, scan stickers with the camera, or type the asset code. No app installation is needed.
- **Automatic exception detection:** missing, wrong location, and condition mismatch, with additional exception types such as QR damaged, not registered, duplicate, and document missing.
- **Remarks and photos.** The company can require a note or a photo whenever an exception is recorded.
- **Resolve exceptions,** or **raise a maintenance ticket** straight from an exception.
- **Live progress** showing verified, exception, and still-unverified counts.
- **Export** the audit results. Past audits remain available for reference.

---

## 10. Vendors

- **Vendor directory** with name, contact person, email, phone, address, service category, and notes.
- **Assign tickets to vendors.** Vendor staff log in and see only their own work.
- **Email notification** when a vendor is assigned a ticket.

---

## 11. Documents

- **Upload documents** to any asset, with a document type and an optional expiry date.
- **Document types:** invoice, warranty, manual, photo, AMC, insurance, handover, other.
- **Required documents per category.** For example, every medical device must have a calibration certificate, and the asset shows which required documents are missing.
- **Expiry reminders** by email before documents expire.
- **Secure storage.** Files are kept in each company's own private storage area, with type and size checks on upload.

---

## 12. Dashboard and reports

- **Home dashboard** with assets by category, status, and location; recent assets; inventory trend; and open maintenance. A period filter is available, and widgets can be configured per role.
- **Attention tiles** that link straight to the problem: assets with no location, unassigned assets, overdue maintenance, expiring warranties, and audit exceptions.
- **Standard reports**, downloadable as CSV or Excel, with a choice of columns:

| Report | What it shows |
| --- | --- |
| Asset register | Every asset with code, category, location, status, custodian, purchase and cover dates |
| Assets by status | How many assets are in each status |
| Assets by location | How many assets are at each location |
| Assets by custodian | How many assets each person holds |
| Missing location or unassigned | Gaps to clean up |
| Overdue maintenance | Open tickets past their due date |
| Warranty / AMC / insurance | Cover that is still running, for renewal planning |
| Audit exceptions | Every problem found across audits, with the auditor's notes |

---

## 13. Bulk import

- **Import assets from CSV** using a downloadable template.
- **Preview before saving.** Errors are shown row by row before anything is created.
- **Error report** download for the rows that failed.
- **Import history** with counts for every import.

---

## 14. Notifications and email

- **In-app notification bell** (info, warning, critical), with mark-as-read.
- **Automatic emails** when an asset is assigned, returned, or transferred; when a maintenance ticket is created; and when a vendor is assigned.
- **Scheduled reminders** for warranty expiry, AMC expiry, insurance, document expiry, and maintenance due dates. The company chooses how many days in advance.
- **Editable email templates** per company, with a test-send button.
- **Email log** showing what was sent and what failed.

---

## 15. Plans, billing and payments

- **Monthly plans** priced in INR, sized by the number of assets, with user and storage limits and the modules included.
- **Online payment** through Razorpay subscriptions.
- **Extra asset packs** can be bought from Settings when the company outgrows its plan.
- **Invoices** can be viewed and printed in the app.
- **Read-only mode.** If a payment lapses, the workspace stays viewable but becomes read-only until billing is brought up to date, so no data is lost.

---

## 16. Platform administration (Mulsetu)

- **Companies:** list, create, edit, assign plans, set subscription status, grant extra assets, suspend, or delete.
- **Plans:** create and edit pricing, limits, and included modules.
- **Asset orders:** fulfil or cancel extra-pack requests.
- **Payments:** view online payments and record offline payments.
- **Storage usage** per company against its limit.
- **Leads CRM:** demo and inquiry requests from the public website.

---

## 17. Security at a glance

- Each company's data is isolated at the database level, not only in the app.
- Every action is checked against the user's role and the company's plan.
- File uploads are checked for type and size, and stored privately per company.
- Login, signup, and password-reset attempts are rate-limited.
- Invitation links are single-use, time-limited, and stored securely.
- The public QR page never exposes financial or personal information.

---

## 18. Coming soon (roadmap)

These features are planned but **not yet available**:

- Two-factor authentication and single sign-on (SSO)
- Bulk edit and bulk assignment of assets; accessory tracking as separate items
- Barcode (Code128/EAN) and NFC/RFID tags
- Asset requests, procurement, and multi-step approval workflows
- Employee offboarding (return all assets before deactivation)
- Maintenance ticket comments, attachments, SLAs, and escalation
- Auditor assignment, audits by category or custodian, audit comparison and certificates
- Vendor contracts, AMC/warranty contract records, and vendor ratings
- Document versioning and approval
- PDF reports, scheduled report emails, and Excel import
- Public API and webhooks, WhatsApp/SMS alerts, offline mobile app, and ERP/HRMS integrations
