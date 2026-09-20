import "server-only";
import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export interface CreateCompanyInput {
  name: string;
  slug: string;
  isDedicatedInfra: boolean;
}

export type CreateCompanyResult = { id: string } | { error: string };

/**
 * Raw insert only — validation and authorization happen in actions.ts.
 * Uses the service-role client deliberately: a brand-new company has no
 * `id` yet for an RLS policy to scope against, so there's no
 * RLS-respecting way to do this insert (see the note in
 * supabase/migrations/0003_companies.sql).
 *
 * The default "Admin" role and first-user invite are created separately
 * right after this (see modules/companies/actions.ts) — this only ever
 * inserts the company row itself. There's still no company_settings row
 * at this point; generateAssetCode() and adjust_storage_used() both
 * upsert one lazily on first use, so that's fine.
 */
export async function createCompany(input: CreateCompanyInput): Promise<CreateCompanyResult> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("companies")
    .insert({
      name: input.name,
      slug: input.slug,
      is_dedicated_infra: input.isDedicatedInfra,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    // Both "slug already taken" (unique violation) and "slug is reserved"
    // (the check_slug_not_reserved trigger) raise 23505 — see
    // supabase/migrations/0004_reserved_slugs.sql.
    if (error?.code === "23505") {
      return { error: "This slug is already taken or reserved. Choose a different one." };
    }
    return { error: "Could not create the company." };
  }

  return { id: data.id };
}

export interface UpdateCompanyInput {
  name: string;
  isDedicatedInfra: boolean;
}

export type UpdateCompanyResult = { success: true } | { error: string };

/**
 * Slug is deliberately not accepted here — it's read-only after creation
 * since tenant login URLs (`/[slug]/login`) and every stored invite/reset
 * link already bake it in. Validation and authorization happen in
 * actions.ts.
 */
export async function updateCompany(
  companyId: string,
  input: UpdateCompanyInput,
): Promise<UpdateCompanyResult> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("companies")
    .update({ name: input.name, is_dedicated_infra: input.isDedicatedInfra })
    .eq("id", companyId);

  if (error) {
    return { error: "Could not update the company." };
  }

  return { success: true };
}

export type DeleteCompanyResult = { success: true } | { error: string };

/**
 * Deletes the company row. Every tenant-owned table has `company_id ...
 * on delete cascade` (see supabase/migrations), so this alone removes
 * every row scoped to this company — including `public.users`. It does
 * NOT touch `auth.users`; call deleteAuthUsersByIds with the ids collected
 * via getUserIdsForCompany *before* this runs, or the admin email(s) stay
 * registered and can't be reused for a new company.
 */
export async function deleteCompany(companyId: string): Promise<DeleteCompanyResult> {
  const supabase = createAdminClient();

  const { error } = await supabase.from("companies").delete().eq("id", companyId);

  if (error) {
    return { error: "Could not delete the company." };
  }

  return { success: true };
}

/**
 * Best-effort cleanup of the `auth.users` accounts that belonged to a
 * just-deleted company, so their emails are free for a brand-new company.
 * One failure shouldn't block the others — each id is deleted
 * independently and errors are swallowed, since the company row (and its
 * data) is already gone by the time this runs; there's nothing left to
 * roll back to.
 */
export async function deleteAuthUsersByIds(userIds: string[]): Promise<void> {
  const supabase = createAdminClient();

  await Promise.all(
    userIds.map((id) => supabase.auth.admin.deleteUser(id).catch(() => undefined)),
  );
}

export type CreateInviteResult = { token: string } | { error: string };

/**
 * The one-time "set your password" token for a new company's first
 * admin. Service-role client for the same bootstrap reason as
 * createCompany: no session scoped to the new company exists yet, and
 * the invitee (who doesn't have an account at all) certainly has none.
 */
export async function createCompanyInvite(
  companyId: string,
  roleId: string,
  email: string,
  invitedBy: string | null,
): Promise<CreateInviteResult> {
  const supabase = createAdminClient();
  const token = randomBytes(32).toString("hex");

  const { error } = await supabase.from("company_invites").insert({
    company_id: companyId,
    role_id: roleId,
    email,
    token,
    invited_by: invitedBy,
  });

  if (error) {
    return { error: "Could not create the invite." };
  }

  return { token };
}

export interface UpdateCompanyBrandingInput {
  name: string;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
}

export type UpdateCompanyBrandingResult = { success: true } | { error: string };

/**
 * Tenant self-service edit of the caller's own company (name + branding
 * only — no slug, no isDedicatedInfra). Session-scoped client, not the
 * admin client: RLS's companies_tenant_isolation policy (migration 0003)
 * already lets a company's own members update their own row, so this
 * relies on that rather than bypassing it.
 */
export async function updateCompanyBranding(
  companyId: string,
  input: UpdateCompanyBrandingInput,
): Promise<UpdateCompanyBrandingResult> {
  const supabase = createClient();

  const { error } = await supabase
    .from("companies")
    .update({
      name: input.name,
      logo_url: input.logoUrl,
      primary_color: input.primaryColor,
      secondary_color: input.secondaryColor,
    })
    .eq("id", companyId);

  if (error) {
    return { error: "Could not update company settings." };
  }

  return { success: true };
}
