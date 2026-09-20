import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { CompanyBranding, CompanySummary } from "./types";

interface CompanyBrandingRow {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
}

/**
 * Looks up a company's public branding by slug. Uses the service-role
 * client deliberately: this must work pre-auth (a visitor hasn't signed in
 * yet when they load their company's login page), and RLS on `companies`
 * only ever grants access to `authenticated` users scoped to their own
 * company. Only the columns needed to brand a login page are selected.
 *
 * A reserved slug (see reserved_slugs) can never belong to a real company —
 * the database enforces that at creation time — so this returns null for
 * those too, with no special-casing needed here.
 */
export async function getCompanyBySlug(slug: string): Promise<CompanyBranding | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("companies")
    .select("id, slug, name, logo_url, primary_color, secondary_color")
    .eq("slug", slug)
    .maybeSingle<CompanyBrandingRow>();

  if (error || !data) {
    return null;
  }

  return {
    id: data.id,
    slug: data.slug,
    name: data.name,
    logoUrl: data.logo_url,
    primaryColor: data.primary_color,
    secondaryColor: data.secondary_color,
  };
}

interface CompanySummaryRow {
  id: string;
  name: string;
  slug: string;
  is_dedicated_infra: boolean;
  created_at: string;
}

interface CompanyEmailRow {
  email: string;
  company_id: string;
}

/**
 * Every company on the platform, for the super-admin company list. Uses
 * the session-bound client deliberately, not the admin client: the
 * `companies_super_admin_bypass` RLS policy already lets an authenticated
 * super admin see every row, so there's no need to step outside RLS here.
 *
 * Admin email is the earliest accepted user on that company, falling
 * back to the earliest invite if nobody has signed in yet.
 */
export async function listCompanies(): Promise<CompanySummary[]> {
  const supabase = createClient();

  const [companiesRes, usersRes, invitesRes] = await Promise.all([
    supabase
      .from("companies")
      .select("id, name, slug, is_dedicated_infra, created_at")
      .order("created_at", { ascending: false })
      .returns<CompanySummaryRow[]>(),
    supabase
      .from("users")
      .select("email, company_id")
      .order("created_at", { ascending: true })
      .returns<CompanyEmailRow[]>(),
    supabase
      .from("company_invites")
      .select("email, company_id")
      .order("created_at", { ascending: true })
      .returns<CompanyEmailRow[]>(),
  ]);

  if (companiesRes.error || !companiesRes.data) {
    return [];
  }

  const emailByCompanyId = new Map<string, string>();
  for (const row of usersRes.data ?? []) {
    if (!emailByCompanyId.has(row.company_id)) {
      emailByCompanyId.set(row.company_id, row.email);
    }
  }
  for (const row of invitesRes.data ?? []) {
    if (!emailByCompanyId.has(row.company_id)) {
      emailByCompanyId.set(row.company_id, row.email);
    }
  }

  return companiesRes.data.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    adminEmail: emailByCompanyId.get(row.id) ?? null,
    isDedicatedInfra: row.is_dedicated_infra,
    createdAt: row.created_at,
  }));
}

/**
 * Every `public.users.id` belonging to a company, collected right before a
 * cascading delete removes those rows. The FK from `public.users` to
 * `auth.users` cascades the other way (deleting the company cascades to
 * `public.users`, which does NOT touch `auth.users`) — this list is what
 * lets the caller explicitly clean up the matching `auth.users` accounts
 * afterward so the same email can sign up again under a new company. Uses
 * the service-role client: this runs as part of a super-admin-only delete
 * flow that's already authorized before this is called.
 */
export async function getUserIdsForCompany(companyId: string): Promise<string[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("users")
    .select("id")
    .eq("company_id", companyId)
    .returns<{ id: string }[]>();

  if (error || !data) {
    return [];
  }

  return data.map((row) => row.id);
}

/**
 * Looks up a company's branding by id for an already-authenticated caller
 * (e.g. the dashboard top bar). Uses the session-bound client, not the
 * admin client: RLS already scopes an authenticated user to their own
 * company, which is exactly the access this needs.
 */
export async function getCompanyById(id: string): Promise<CompanyBranding | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("companies")
    .select("id, slug, name, logo_url, primary_color, secondary_color")
    .eq("id", id)
    .maybeSingle<CompanyBrandingRow>();

  if (error || !data) {
    return null;
  }

  return {
    id: data.id,
    slug: data.slug,
    name: data.name,
    logoUrl: data.logo_url,
    primaryColor: data.primary_color,
    secondaryColor: data.secondary_color,
  };
}
