"use server";

import "server-only";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { TENANT_HEADERS } from "@/lib/tenant";
import { isCurrentUserSuperAdmin } from "@/lib/permissions/super-admin";
import { requirePermission } from "@/lib/permissions/has-permission";
import { createClient } from "@/lib/supabase/server";
import { sendUserInviteEmail } from "@/lib/email";
import { createSystemAdminRole } from "@/modules/roles/mutations";
import { seedDefaultAssetStatuses } from "@/modules/statuses/mutations";
import { uploadFileToR2 } from "@/modules/storage/mutations";
import { createCompanySchema, slugSchema, updateCompanyBrandingSchema, updateCompanySchema } from "./validation";
import { getCompanyBySlug, getCompanyById, getUserIdsForCompany, listCompanies } from "./queries";
import {
  createCompany,
  createCompanyInvite,
  deleteAuthUsersByIds,
  deleteCompany,
  updateCompany,
  updateCompanyBranding,
} from "./mutations";
import type {
  CompanyBranding,
  CompanySummary,
  CreateCompanyState,
  DeleteCompanyState,
  UpdateCompanyBrandingState,
  UpdateCompanyState,
} from "./types";

/**
 * Controller entry point for rendering a tenant's login page. Validates
 * the slug shape before it ever reaches a query, then delegates to the
 * Model layer. Pages call this, never queries.ts directly.
 */
export async function getCompanyForLogin(slug: string): Promise<CompanyBranding | null> {
  const parsed = slugSchema.safeParse(slug);
  if (!parsed.success) {
    return null;
  }

  return getCompanyBySlug(parsed.data);
}

/**
 * The signed-in caller's own company, for rendering things like the
 * dashboard top bar. `company_id` comes from the x-company-id header
 * middleware.ts attaches after verifying the session — never from a
 * client-supplied value.
 */
export async function getCurrentCompany(): Promise<CompanyBranding | null> {
  const companyId = headers().get(TENANT_HEADERS.companyId);
  if (!companyId) {
    return null;
  }

  return getCompanyById(companyId);
}

/** Every company on the platform. Super-admin only — see /admin. */
export async function listCompaniesForAdmin(): Promise<CompanySummary[]> {
  if (!(await isCurrentUserSuperAdmin())) {
    return [];
  }

  return listCompanies();
}

/**
 * Creates the company, seeds its default full-permission "Admin" role,
 * and creates a one-time invite for the admin email given — then either
 * emails the setup link (production, real Brevo key) or hands the link
 * back directly (development, so testing never depends on Brevo — see
 * lib/email.ts's shouldSendReal()). Doesn't redirect: the caller needs to
 * see that link.
 */
export async function createCompanyAction(
  _prevState: CreateCompanyState,
  formData: FormData,
): Promise<CreateCompanyState> {
  if (!(await isCurrentUserSuperAdmin())) {
    return { error: "Not authorized." };
  }

  const parsed = createCompanySchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    isDedicatedInfra: formData.get("isDedicatedInfra") === "on",
    adminEmail: formData.get("adminEmail"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const companyResult = await createCompany(parsed.data);
  if ("error" in companyResult) {
    return { error: companyResult.error };
  }

  const roleResult = await createSystemAdminRole(companyResult.id);
  if ("error" in roleResult) {
    return { error: roleResult.error };
  }

  const statusSeedResult = await seedDefaultAssetStatuses(companyResult.id);
  if (statusSeedResult.error) {
    return { error: statusSeedResult.error };
  }

  const supabase = createClient();
  const {
    data: { user: currentSuperAdmin },
  } = await supabase.auth.getUser();

  const inviteResult = await createCompanyInvite(
    companyResult.id,
    roleResult.id,
    parsed.data.adminEmail,
    currentSuperAdmin?.id ?? null,
  );
  if ("error" in inviteResult) {
    return { error: inviteResult.error };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const inviteUrl = `${appUrl}/invite/${inviteResult.token}`;

  const emailResult = await sendUserInviteEmail({
    to: parsed.data.adminEmail,
    companyName: parsed.data.name,
    inviteUrl,
  });

  revalidatePath("/admin");

  const isProd = process.env.NODE_ENV === "production";
  const showLinkDirectly = !isProd || "error" in emailResult;

  return { error: null, inviteUrl: showLinkDirectly ? inviteUrl : undefined };
}

/**
 * Edits a company's name/dedicated-infra flag. Slug is never accepted here
 * (see updateCompanySchema) — it's baked into every tenant login/reset/
 * invite URL already issued, so it stays read-only after creation.
 */
export async function updateCompanyAction(
  companyId: string,
  _prevState: UpdateCompanyState,
  formData: FormData,
): Promise<UpdateCompanyState> {
  if (!(await isCurrentUserSuperAdmin())) {
    return { error: "Not authorized." };
  }

  const parsed = updateCompanySchema.safeParse({
    name: formData.get("name"),
    isDedicatedInfra: formData.get("isDedicatedInfra") === "on",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const result = await updateCompany(companyId, parsed.data);
  if ("error" in result) {
    return { error: result.error };
  }

  revalidatePath("/admin");

  return { error: null, success: true };
}

/**
 * Tenant admin's own Settings page — company name + branding only.
 * companyId always comes from the x-company-id header (never the form),
 * so a caller can never target another tenant's row even though the
 * schema itself accepts no id.
 */
export async function updateCompanyBrandingAction(
  _prevState: UpdateCompanyBrandingState,
  formData: FormData,
): Promise<UpdateCompanyBrandingState> {
  if (!(await requirePermission("settings", "edit"))) {
    return { error: "You don't have permission to edit settings." };
  }

  const companyId = headers().get(TENANT_HEADERS.companyId);
  if (!companyId) {
    return { error: "Could not determine your company." };
  }

  const parsed = updateCompanyBrandingSchema.safeParse({
    name: formData.get("name"),
    primaryColor: formData.get("primaryColor"),
    secondaryColor: formData.get("secondaryColor"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const current = await getCompanyById(companyId);
  let logoUrl = current?.logoUrl ?? null;

  const logoFile = formData.get("logo");
  if (logoFile instanceof File && logoFile.size > 0) {
    const uploadResult = await uploadFileToR2({ companyId, folder: "branding", file: logoFile });
    if ("error" in uploadResult) {
      return { error: uploadResult.error };
    }
    logoUrl = uploadResult.url;
  }

  const result = await updateCompanyBranding(companyId, {
    name: parsed.data.name,
    logoUrl,
    primaryColor: parsed.data.primaryColor,
    secondaryColor: parsed.data.secondaryColor,
  });
  if ("error" in result) {
    return { error: result.error };
  }

  revalidatePath("/dashboard/administration/settings");
  revalidatePath("/", "layout");
  if (current?.slug) {
    revalidatePath(`/${current.slug}/login`);
  }

  return { error: null, success: true };
}

/**
 * Deletes a company and everything under it. `company_id ... on delete
 * cascade` on every tenant table takes care of the data itself, but the
 * `auth.users` accounts that belonged to it are a separate system Postgres
 * cascades don't reach — collected here *before* the delete removes the
 * `public.users` rows that record who they were, then removed explicitly
 * so their emails are immediately free for a brand-new company.
 */
export async function deleteCompanyAction(companyId: string): Promise<DeleteCompanyState> {
  if (!(await isCurrentUserSuperAdmin())) {
    return { error: "Not authorized." };
  }

  const userIds = await getUserIdsForCompany(companyId);

  const result = await deleteCompany(companyId);
  if ("error" in result) {
    return { error: result.error };
  }

  if (userIds.length > 0) {
    await deleteAuthUsersByIds(userIds);
  }

  revalidatePath("/admin");

  return { error: null, success: true };
}
