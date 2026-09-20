import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CompanyUserSummary, CurrentUser, InviteDetails, PendingInviteSummary } from "./types";

interface UserWithRoleRow {
  id: string;
  email: string;
  full_name: string | null;
  company_id: string;
  roles: { id: string; name: string } | null;
}

/**
 * The given user's own tenant profile, including role name. Uses the
 * session-bound client: RLS's `users_tenant_isolation` policy always lets a
 * user read their own row, so this only ever works for `userId === auth.uid()`.
 */
export async function getUserWithRole(userId: string): Promise<CurrentUser | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("users")
    .select("id, email, full_name, company_id, roles(id, name)")
    .eq("id", userId)
    .maybeSingle<UserWithRoleRow>();

  if (error || !data) {
    return null;
  }

  return {
    id: data.id,
    email: data.email,
    fullName: data.full_name,
    companyId: data.company_id,
    role: data.roles ? { id: data.roles.id, name: data.roles.name } : null,
  };
}

interface InviteRow {
  id: string;
  company_id: string;
  role_id: string;
  email: string;
  expires_at: string;
  accepted_at: string | null;
  companies: { name: string; slug: string } | null;
}

/**
 * Looks up an invite by its token for the /invite/[token] accept page.
 * Admin client deliberately: the invitee has no session at all yet.
 */
export async function getInviteByToken(token: string): Promise<InviteDetails | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("company_invites")
    .select("id, company_id, role_id, email, expires_at, accepted_at, companies(name, slug)")
    .eq("token", token)
    .maybeSingle<InviteRow>();

  if (error || !data || !data.companies) {
    return null;
  }

  return {
    id: data.id,
    companyId: data.company_id,
    companyName: data.companies.name,
    companySlug: data.companies.slug,
    roleId: data.role_id,
    email: data.email,
    isExpired: new Date(data.expires_at) < new Date(),
    isAccepted: data.accepted_at !== null,
  };
}

interface CompanyUserRow {
  id: string;
  email: string;
  full_name: string | null;
  is_active: boolean;
  role_id: string;
  created_at: string;
  roles: { name: string } | null;
}

/** Every member of the caller's own company (RLS-scoped), for the Users admin page. */
export async function listCompanyUsers(): Promise<CompanyUserSummary[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("users")
    .select("id, email, full_name, is_active, role_id, created_at, roles(name)")
    .order("created_at")
    .returns<CompanyUserRow[]>();

  if (error || !data) {
    return [];
  }

  return data.map((row) => ({
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    isActive: row.is_active,
    roleId: row.role_id,
    roleName: row.roles?.name ?? "—",
    createdAt: row.created_at,
  }));
}

interface PendingInviteRow {
  id: string;
  email: string;
  expires_at: string;
  accepted_at: string | null;
  roles: { name: string } | null;
}

/** Not-yet-accepted invites for the caller's own company (RLS-scoped). */
export async function listPendingInvites(): Promise<PendingInviteSummary[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("company_invites")
    .select("id, email, expires_at, accepted_at, roles(name)")
    .is("accepted_at", null)
    .order("created_at", { ascending: false })
    .returns<PendingInviteRow[]>();

  if (error || !data) {
    return [];
  }

  return data.map((row) => ({
    id: row.id,
    email: row.email,
    roleName: row.roles?.name ?? "—",
    expiresAt: row.expires_at,
    isExpired: new Date(row.expires_at) < new Date(),
  }));
}
