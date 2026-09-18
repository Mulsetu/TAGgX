import { z } from "zod";

// Mirrors the CHECK constraint on companies.slug
// (supabase/migrations/0003_companies.sql). The two alternatives can't
// match the same characters (one requires a leading "-"), so this regex
// backtracks linearly, not exponentially — verified from the string's
// nature, not just length, so this isn't a real ReDoS risk.
// eslint-disable-next-line security/detect-unsafe-regex
const SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const slugSchema = z
  .string()
  .min(2)
  .max(63)
  .regex(SLUG_REGEX, "Slug must be lowercase letters, numbers, and hyphens only");

export const createCompanySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  slug: slugSchema,
  isDedicatedInfra: z.boolean(),
  adminEmail: z.string().trim().email("Enter a valid admin email"),
});

// Slug is deliberately excluded — read-only after creation, see
// modules/companies/mutations.ts's updateCompany.
export const updateCompanySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  isDedicatedInfra: z.boolean(),
});

// Mirrors the companies_primary_color_format / companies_secondary_color_format
// CHECK constraints (supabase/migrations/0013_companies_branding.sql).
const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;
const hexColorSchema = z
  .string()
  .trim()
  .regex(HEX_COLOR_REGEX, "Enter a hex color like #4F46E5")
  .nullable()
  .or(z.literal("").transform(() => null));

// Tenant-scoped self-service edit (settings permission) — deliberately a
// narrower surface than updateCompanySchema: no slug, no isDedicatedInfra
// (super-admin only). logoUrl isn't here — it's produced by the upload
// step in actions.ts, not typed in from the form.
const emptyToUndefined = (value: unknown) => (value === "" || value === null ? undefined : value);

export const updateCompanyBrandingSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  primaryColor: hexColorSchema,
  secondaryColor: hexColorSchema,
  contactEmail: z.preprocess(emptyToUndefined, z.string().trim().email().max(320).optional().nullable()),
  contactPhone: z.preprocess(emptyToUndefined, z.string().trim().max(40).optional().nullable()),
  contactAddress: z.preprocess(emptyToUndefined, z.string().trim().max(500).optional().nullable()),
});

export const updateWorkspaceSettingsSchema = z.object({
  assetCodeFormat: z
    .string()
    .trim()
    .min(3, "Format is required")
    .max(40)
    .regex(/\{SEQ(?::0?\d+d)?\}/, "Include {SEQ:05d} so each asset gets a unique number"),
});
