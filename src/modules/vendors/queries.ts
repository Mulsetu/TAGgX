import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { VendorOption, VendorSummary } from "./types";

interface VendorRow {
  id: string;
  name: string;
  company_name: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  is_active: boolean;
}

export async function listVendors(): Promise<VendorSummary[]> {
  const supabase = createClient();
  // Explicit cap: PostgREST's own default row limit is a project setting,
  // not something this code should depend on silently.
  const { data } = await supabase
    .from("vendors")
    .select("id, name, company_name, contact_name, email, phone, is_active")
    .order("name")
    .limit(1000)
    .returns<VendorRow[]>();

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    companyName: row.company_name,
    contactName: row.contact_name,
    email: row.email,
    phone: row.phone,
    isActive: row.is_active,
  }));
}

export async function listActiveVendorOptions(): Promise<VendorOption[]> {
  const vendors = await listVendors();
  return vendors.filter((vendor) => vendor.isActive).map((vendor) => ({
    id: vendor.id,
    name: vendor.name,
    email: vendor.email,
  }));
}

export async function getVendorById(id: string): Promise<VendorOption | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("vendors")
    .select("id, name, email")
    .eq("id", id)
    .maybeSingle<{ id: string; name: string; email: string | null }>();
  if (!data) {
    return null;
  }
  return { id: data.id, name: data.name, email: data.email };
}
