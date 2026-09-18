import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { CrmLead, LeadFilters, LeadListPage, LeadSource, LeadStatus } from "./types";

const LEAD_COLUMNS =
  "id, source, full_name, email, phone, company_name, job_title, asset_count, message, preferred_date, status, notes, created_at, updated_at";

const PAGE_SIZE = 50;

interface CrmLeadRow {
  id: string;
  source: LeadSource;
  full_name: string;
  email: string;
  phone: string | null;
  company_name: string | null;
  job_title: string | null;
  asset_count: string | null;
  message: string | null;
  preferred_date: string | null;
  status: LeadStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

function mapLead(row: CrmLeadRow): CrmLead {
  return {
    id: row.id,
    source: row.source,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    companyName: row.company_name,
    jobTitle: row.job_title,
    assetCount: row.asset_count,
    message: row.message,
    preferredDate: row.preferred_date,
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listLeadsForAdmin(filters: LeadFilters): Promise<LeadListPage> {
  const supabase = createClient();
  const page = filters.page && filters.page > 0 ? filters.page : 1;
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from("crm_leads")
    .select(LEAD_COLUMNS, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (filters.source) {
    query = query.eq("source", filters.source);
  }
  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  const { data, error, count } = await query.returns<CrmLeadRow[]>();

  if (error || !data) {
    return { leads: [], total: 0, page, pageSize: PAGE_SIZE };
  }

  return {
    leads: data.map(mapLead),
    total: count ?? data.length,
    page,
    pageSize: PAGE_SIZE,
  };
}

export async function countNewLeadsForAdmin(): Promise<number> {
  const supabase = createClient();
  const { count, error } = await supabase
    .from("crm_leads")
    .select("id", { count: "exact", head: true })
    .eq("status", "new");

  if (error || count === null) {
    return 0;
  }

  return count;
}
