import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { VendorFormInput } from "./validation";

export async function createVendor(companyId: string, input: VendorFormInput): Promise<{ id: string } | { error: string }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("vendors")
    .insert({
      company_id: companyId,
      name: input.name,
      company_name: input.companyName ?? null,
      contact_name: input.contactName ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      address: input.address ?? null,
      service_category: input.serviceCategory ?? null,
      is_active: input.isActive ?? true,
      notes: input.notes ?? null,
    })
    .select("id")
    .single<{ id: string }>();
  if (error || !data) {
    return { error: error?.code === "23505" ? "A vendor with this name already exists." : "Could not save the vendor." };
  }
  return data;
}

export async function updateVendor(id: string, input: VendorFormInput): Promise<{ error: string | null }> {
  const supabase = createClient();
  const { error } = await supabase
    .from("vendors")
    .update({
      name: input.name,
      company_name: input.companyName ?? null,
      contact_name: input.contactName ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      address: input.address ?? null,
      service_category: input.serviceCategory ?? null,
      is_active: input.isActive ?? true,
      notes: input.notes ?? null,
    })
    .eq("id", id);
  return { error: error ? "Could not save the vendor." : null };
}
