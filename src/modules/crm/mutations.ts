import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { LeadSource, LeadStatus } from "./types";

export type MutationResult = { id: string } | { error: string };

export interface InsertLeadInput {
  source: LeadSource;
  fullName: string;
  email: string;
  phone: string | null;
  companyName: string | null;
  jobTitle: string | null;
  assetCount: string | null;
  message: string | null;
  preferredDate: string | null;
}

export async function insertLead(input: InsertLeadInput): Promise<MutationResult> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("crm_leads")
    .insert({
      source: input.source,
      full_name: input.fullName,
      email: input.email,
      phone: input.phone,
      company_name: input.companyName,
      job_title: input.jobTitle,
      asset_count: input.assetCount,
      message: input.message,
      preferred_date: input.preferredDate,
      status: "new",
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    return { error: "Could not save your request. Try again in a moment." };
  }

  return { id: data.id };
}

export async function updateLeadStatus(input: {
  id: string;
  status: LeadStatus;
  notes: string | null;
}): Promise<{ success: true } | { error: string }> {
  const supabase = createClient();

  const { error } = await supabase
    .from("crm_leads")
    .update({
      status: input.status,
      notes: input.notes,
    })
    .eq("id", input.id);

  if (error) {
    return { error: "Could not update this lead." };
  }

  return { success: true };
}
