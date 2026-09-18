# Asset Fields

Field set backing `public.assets` (base table: `supabase/migrations/0010_assets.sql`,
reshaped by `0017_assets_field_redesign.sql`), grouped the way the create/edit form at
`/assets/new` and `/assets/[id]` presents them. The Basic Info section is always
expanded; Additional Info and Purchase Info are collapsed by default.

## Basic Info

| Field | Column | Type | Notes |
|---|---|---|---|
| Name | `name` | text, required | |
| Image | `image_url` | text | Nullable. File upload isn't wired to R2 yet (Phase 8) — see `src/app/(dashboard)/assets/asset-form.tsx`. |
| Code | `asset_code` | text, required, unique per company | Either typed manually or auto-generated from `company_settings.asset_code_format` + `company_settings.next_asset_sequence` (see `modules/assets/mutations.ts`). |
| Category | `category_id` | uuid, FK → `asset_categories`, required | |
| Location | `location_id` | uuid, FK → `locations`, required | |
| CWIP invoice ID | `cwip_invoice_id` | text | Nullable. Capital-work-in-progress invoice reference. |
| Status | `status` | text, required | One of `active`, `in_repair`, `retired`, `disposed`, `lost`. |

## Additional Info

| Field | Column | Type | Notes |
|---|---|---|---|
| Condition | `condition` | text | One of `new`, `good`, `fair`, `poor`. Nullable. |
| Brand | `brand` | text | Nullable. |
| Model | `model` | text | Nullable. |
| Linked asset | `linked_asset_id` | uuid, FK → `assets` (self) | Nullable; `on delete set null`. |
| Description | `description` | text | Nullable. |
| Serial No. | `serial_number` | text | Nullable. |
| Attachments | `asset_documents` rows | — | Many-to-one via `asset_documents.asset_id`. Upload isn't wired to R2 yet (Phase 8). |

## Purchase Info

| Field | Column | Type | Notes |
|---|---|---|---|
| Vendor | `vendor` | text | Nullable. |
| PO number | `po_number` | text | Nullable. |
| Invoice date | `invoice_date` | date | Nullable. |
| Invoice number | `invoice_number` | text | Nullable. |
| Purchase date | `purchase_date` | date | Nullable. |
| Purchase price | `purchase_price` | numeric(12,2) | Nullable. |
| Ownership | `ownership_type` | text, required | `owned` or `partner`. Default `owned`. |
| Partner name | `partner_name` | text | Required (app-level, not a DB constraint) when `ownership_type = 'partner'`. |
| **Allotment block** | | | |
| Allotted to | `allotted_to` | uuid, FK → `users` | Nullable; `on delete set null`. |
| Allotment date | `allotment_date` | date | Nullable. |
| **Warranty / AMC / Insurance block** | | | |
| Warranty start | `warranty_start_date` | date | Nullable. |
| Warranty end | `warranty_end_date` | date | Nullable. |
| AMC provider | `amc_provider` | text | Nullable. |
| AMC start | `amc_start_date` | date | Nullable. |
| AMC end | `amc_end_date` | date | Nullable. |
| Insurance provider | `insurance_provider` | text | Nullable. |
| Insurance policy number | `insurance_policy_number` | text | Nullable. |
| Insurance expiry | `insurance_expiry_date` | date | Nullable. |

## System / other columns

`id`, `company_id`, `created_by`, `created_at`, `updated_at` — same pattern as every
other tenant-scoped table (see `/docs/FOLDER_STRUCTURE.md`). `custom_fields` (jsonb,
default `{}`) still exists as a per-company escape hatch but isn't exposed in the form.

## QR tag

Not a column — the detail page (`/assets/[id]`) generates a QR code on demand from the
asset's own `id` (`{origin}/assets/{id}`), rendered client-side via the `qrcode`
package. No tag identifier is persisted.

Changing this list means updating, in lockstep: the migration, `modules/assets/types.ts`,
`modules/assets/validation.ts` (zod schema), and this document.
