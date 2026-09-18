import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { LocationFormInput } from "./validation";

export type LocationMutationResult = { id: string } | { error: string };

function friendlyError(code: string | undefined): string {
  if (code === "23505") return "A location with this name already exists at this level.";
  return "Could not save the location.";
}

function buildLocationFields(input: LocationFormInput) {
  return {
    name: input.name,
    kind: input.kind,
    address_line1: input.addressLine1 ?? null,
    address_line2: input.addressLine2 ?? null,
    city: input.city ?? null,
    state: input.state ?? null,
    postal_code: input.postalCode ?? null,
    country: input.country ?? null,
    parent_location_id: input.parentLocationId ?? null,
  };
}

export async function createLocation(
  companyId: string,
  input: LocationFormInput,
): Promise<LocationMutationResult> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("locations")
    .insert({ company_id: companyId, ...buildLocationFields(input) })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    return { error: friendlyError(error?.code) };
  }

  return { id: data.id };
}

export async function updateLocation(
  id: string,
  input: LocationFormInput,
): Promise<LocationMutationResult> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("locations")
    .update(buildLocationFields(input))
    .eq("id", id)
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    return { error: friendlyError(error?.code) };
  }

  return { id: data.id };
}

export async function deleteLocation(id: string): Promise<{ error: string | null }> {
  const supabase = createClient();

  const { error } = await supabase.from("locations").delete().eq("id", id);

  if (error) {
    return { error: "Could not delete the location." };
  }

  return { error: null };
}
