import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateInviteToken, hashInviteToken } from "@/lib/invite-token";
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

export async function setCompanySuspended(
  companyId: string,
  suspended: boolean,
): Promise<UpdateCompanyResult> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("companies")
    .update({ suspended_at: suspended ? new Date().toISOString() : null })
    .eq("id", companyId);

  if (error) {
    return { error: "Could not update suspension." };
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
  vendorId?: string | null,
): Promise<CreateInviteResult> {
  const supabase = createAdminClient();
  const token = generateInviteToken();

  const { error } = await supabase.from("company_invites").insert({
    company_id: companyId,
    role_id: roleId,
    email,
    token: null,
    token_hash: hashInviteToken(token),
    invited_by: invitedBy,
    vendor_id: vendorId ?? null,
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
  contactEmail: string | null;
  contactPhone: string | null;
  contactAddress: string | null;
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
      contact_email: input.contactEmail,
      contact_phone: input.contactPhone,
      contact_address: input.contactAddress,
    })
    .eq("id", companyId);

  if (error) {
    return { error: "Could not update company settings." };
  }

  return { success: true };
}

/**
 * Branding write used during public signup, before the new admin has a
 * session. RLS's tenant policy wouldn't let an anonymous caller update
 * the row, so this uses the service-role client. Validation still lives
 * in the signup action.
 */
export async function updateCompanyLogoAdmin(
  companyId: string,
  logoUrl: string,
): Promise<UpdateCompanyBrandingResult> {
  const supabase = createAdminClient();

  const { error } = await supabase.from("companies").update({ logo_url: logoUrl }).eq("id", companyId);

  if (error) {
    return { error: "Could not save the logo." };
  }

  return { success: true };
}

export async function upsertCompanyWorkspaceSettings(
  companyId: string,
  input: {
    assetCodeFormat: string;
    enabledModules: Record<string, boolean>;
    assetFieldConfig: Record<string, unknown>;
    dashboardWidgets: Record<string, unknown>;
    dashboardLayouts: unknown;
    workflowConfig: Record<string, unknown>;
    departmentCatalog: string[];
    disposalMethods: string[];
  },
): Promise<{ error: string | null }> {
  const supabase = createClient();
  const { error } = await supabase.from("company_settings").upsert(
    {
      company_id: companyId,
      asset_code_format: input.assetCodeFormat,
      enabled_modules: input.enabledModules,
      asset_field_config: input.assetFieldConfig,
      dashboard_widgets: input.dashboardWidgets,
      dashboard_layouts: input.dashboardLayouts,
      workflow_config: input.workflowConfig,
      department_catalog: input.departmentCatalog,
      disposal_methods: input.disposalMethods,
    },
    { onConflict: "company_id" },
  );
  return { error: error ? "Could not save workspace settings." : null };
}

const EMAIL_TEMPLATE_SEEDS: { event_key: string; subject: string; html_body: string; text_body: string }[] = [
  { event_key: "asset_assigned", subject: "Asset assigned: {{asset_name}}", html_body: "<p>{{asset_name}} ({{asset_code}}) was assigned.</p><p><a href=\"{{asset_url}}\">Open asset</a></p>", text_body: "{{asset_name}} ({{asset_code}}) was assigned. {{asset_url}}" },
  { event_key: "asset_returned", subject: "Asset returned: {{asset_name}}", html_body: "<p>{{asset_name}} ({{asset_code}}) was returned.</p>", text_body: "{{asset_name}} returned." },
  { event_key: "asset_transferred", subject: "Asset transferred: {{asset_name}}", html_body: "<p>{{asset_name}} ({{asset_code}}) was transferred.</p>", text_body: "{{asset_name}} transferred." },
  { event_key: "maintenance_created", subject: "Maintenance ticket: {{maintenance_title}}", html_body: "<p>Ticket created for {{asset_name}}.</p>", text_body: "Ticket created for {{asset_name}}." },
  { event_key: "maintenance_assigned", subject: "Maintenance assigned: {{maintenance_title}}", html_body: "<p>{{maintenance_title}} was assigned.</p>", text_body: "{{maintenance_title}} assigned." },
  { event_key: "maintenance_due", subject: "Maintenance due: {{asset_name}}", html_body: "<p>{{asset_name}} maintenance is due {{due_date}}.</p>", text_body: "{{asset_name}} due {{due_date}}." },
  { event_key: "warranty_expiry", subject: "Warranty due: {{asset_name}}", html_body: "<p>{{asset_name}} warranty is due {{due_date}}.</p>", text_body: "{{asset_name}} warranty {{due_date}}." },
  { event_key: "amc_expiry", subject: "AMC due: {{asset_name}}", html_body: "<p>{{asset_name}} AMC is due {{due_date}}.</p>", text_body: "{{asset_name}} AMC {{due_date}}." },
  { event_key: "insurance_expiry", subject: "Insurance due: {{asset_name}}", html_body: "<p>{{asset_name}} insurance is due {{due_date}}.</p>", text_body: "{{asset_name}} insurance {{due_date}}." },
  { event_key: "vendor_assigned", subject: "Vendor assignment: {{asset_name}}", html_body: "<p>{{vendor_name}} was assigned to {{asset_name}} / {{maintenance_title}}.</p>", text_body: "{{vendor_name}} assigned." },
  { event_key: "transfer_pending", subject: "Transfer pending: {{asset_name}}", html_body: "<p>{{asset_name}} ({{asset_code}}) is waiting for transfer acknowledgement.</p><p><a href=\"{{asset_url}}\">Open asset</a></p>", text_body: "{{asset_name}} transfer pending. {{asset_url}}" },
  { event_key: "transfer_accepted", subject: "Transfer accepted: {{asset_name}}", html_body: "<p>The transfer of {{asset_name}} was accepted.</p>", text_body: "Transfer of {{asset_name}} accepted." },
  { event_key: "transfer_rejected", subject: "Transfer rejected: {{asset_name}}", html_body: "<p>The transfer of {{asset_name}} was rejected.</p>", text_body: "Transfer of {{asset_name}} rejected." },
  { event_key: "document_expiry", subject: "Document expiring: {{asset_name}}", html_body: "<p>A document on {{asset_name}} expires {{due_date}}.</p>", text_body: "Document expiry {{due_date}}." },
];

const NOTIFICATION_RULE_SEEDS: { event_key: string; offset_days: number }[] = [
  { event_key: "warranty_expiry", offset_days: 30 },
  { event_key: "warranty_expiry", offset_days: 15 },
  { event_key: "warranty_expiry", offset_days: 7 },
  { event_key: "warranty_expiry", offset_days: 1 },
  { event_key: "warranty_expiry", offset_days: 0 },
  { event_key: "amc_expiry", offset_days: 30 },
  { event_key: "amc_expiry", offset_days: 7 },
  { event_key: "amc_expiry", offset_days: 0 },
  { event_key: "insurance_expiry", offset_days: 30 },
  { event_key: "insurance_expiry", offset_days: 7 },
  { event_key: "insurance_expiry", offset_days: 0 },
  { event_key: "maintenance_due", offset_days: 7 },
  { event_key: "maintenance_due", offset_days: 1 },
  { event_key: "maintenance_due", offset_days: 0 },
  { event_key: "document_expiry", offset_days: 30 },
  { event_key: "document_expiry", offset_days: 7 },
  { event_key: "document_expiry", offset_days: 0 },
];

/** Catalogs that existing-company migrations seed — also needed for new tenants. */
export async function seedCompanyPlatformCatalogs(companyId: string): Promise<{ error: string | null }> {
  const supabase = createAdminClient();

  const { error: vendorRoleError } = await supabase.from("roles").insert({
    company_id: companyId,
    name: "Vendor",
    description: "Limited access to assigned maintenance tickets.",
    is_system: true,
    permissions: { maintenance: ["view", "edit"], assets: ["view"] },
  });
  if (vendorRoleError && vendorRoleError.code !== "23505") {
    return { error: "Could not seed vendor role." };
  }

  const { error: typesError } = await supabase.from("maintenance_types").insert([
    { company_id: companyId, key: "corrective", name: "Corrective", is_system: true, sort_order: 1 },
    { company_id: companyId, key: "preventive", name: "Preventive", is_system: true, sort_order: 2 },
    { company_id: companyId, key: "inspection", name: "Inspection", is_system: true, sort_order: 3 },
    { company_id: companyId, key: "calibration", name: "Calibration", is_system: true, sort_order: 4 },
    { company_id: companyId, key: "amc", name: "AMC service", is_system: true, sort_order: 5 },
    { company_id: companyId, key: "warranty", name: "Warranty service", is_system: true, sort_order: 6 },
    { company_id: companyId, key: "emergency", name: "Emergency", is_system: true, sort_order: 7 },
  ]);
  if (typesError && typesError.code !== "23505") {
    return { error: "Could not seed maintenance types." };
  }

  const { error: templatesError } = await supabase
    .from("email_templates")
    .insert(EMAIL_TEMPLATE_SEEDS.map((row) => ({ ...row, company_id: companyId })));
  if (templatesError && templatesError.code !== "23505") {
    return { error: "Could not seed email templates." };
  }

  const { error: rulesError } = await supabase.from("notification_rules").insert(
    NOTIFICATION_RULE_SEEDS.map((row) => ({ ...row, company_id: companyId, recipient: "admins" })),
  );
  if (rulesError && rulesError.code !== "23505") {
    return { error: "Could not seed notification rules." };
  }

  const { error: docsError } = await supabase.from("document_types").insert([
    { company_id: companyId, key: "invoice", name: "Purchase invoice", is_system: true },
    { company_id: companyId, key: "warranty", name: "Warranty certificate", is_system: true },
    { company_id: companyId, key: "manual", name: "Manual", is_system: true },
    { company_id: companyId, key: "photo", name: "Photo", is_system: true },
    { company_id: companyId, key: "amc", name: "AMC agreement", is_system: true },
    { company_id: companyId, key: "insurance", name: "Insurance document", is_system: true },
    { company_id: companyId, key: "handover", name: "Handover receipt", is_system: true },
    { company_id: companyId, key: "other", name: "Other", is_system: true },
  ]);
  if (docsError && docsError.code !== "23505") {
    return { error: "Could not seed document types." };
  }

  const { error: exceptionsError } = await supabase.from("audit_exception_types").insert([
    { company_id: companyId, key: "missing", name: "Missing", is_system: true, sort_order: 1 },
    { company_id: companyId, key: "wrong_location", name: "Wrong location", is_system: true, sort_order: 2 },
    { company_id: companyId, key: "condition_mismatch", name: "Condition mismatch", is_system: true, sort_order: 3 },
    { company_id: companyId, key: "wrong_custodian", name: "Wrong custodian", is_system: true, sort_order: 4 },
    { company_id: companyId, key: "qr_damaged", name: "QR code damaged", is_system: true, sort_order: 5 },
    { company_id: companyId, key: "not_registered", name: "Asset not registered", is_system: true, sort_order: 6 },
    { company_id: companyId, key: "duplicate", name: "Duplicate asset", is_system: true, sort_order: 7 },
    { company_id: companyId, key: "document_missing", name: "Document missing", is_system: true, sort_order: 8 },
    { company_id: companyId, key: "damaged", name: "Damaged asset", is_system: true, sort_order: 9 },
    { company_id: companyId, key: "unreadable_qr", name: "Unreadable QR", is_system: true, sort_order: 10 },
    { company_id: companyId, key: "other", name: "Other", is_system: true, sort_order: 11 },
  ]);
  if (exceptionsError && exceptionsError.code !== "23505") {
    return { error: "Could not seed audit exception types." };
  }

  return { error: null };
}

export type DeletionRequestResult = { error: string | null };

/**
 * Flags the caller's own company for deletion review — the actual delete
 * only ever happens through a super admin's deleteCompanyAction in /admin.
 * Runs through the request_company_deletion() RPC (migration 0050), which
 * re-checks Company Admin status at the database layer rather than
 * trusting a column grant — same reasoning as 0048's set_company_admin().
 */
export async function requestCompanyDeletion(reason: string | null): Promise<DeletionRequestResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc("request_company_deletion", { p_reason: reason });
  if (error) {
    return { error: "Could not submit the deletion request." };
  }
  return { error: null };
}

export async function cancelCompanyDeletionRequest(): Promise<DeletionRequestResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc("cancel_company_deletion_request");
  if (error) {
    return { error: "Could not cancel the deletion request." };
  }
  return { error: null };
}
