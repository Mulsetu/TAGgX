"use server";

import "server-only";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { TENANT_HEADERS } from "@/lib/tenant";
import { requirePermission } from "@/lib/permissions/has-permission";
import { TENANT_READ_ONLY_MESSAGE, requireWritableTenant } from "@/lib/permissions/tenant-access";
import { getLocationById, isDescendant, listLocations, locationPathById } from "./queries";
import { createLocation, deleteLocation, updateLocation } from "./mutations";
import { locationFormSchema, parentKindFor } from "./validation";
import { LOCATION_KIND_LABELS, LOCATION_KIND_PARENT } from "./types";
import type { LocationFormState, LocationSummary } from "./types";

const ADMIN_PATH = "/dashboard/administration/locations";

export async function getLocationsForAdmin(): Promise<LocationSummary[]> {
  if (!(await requirePermission("locations", "view"))) {
    return [];
  }
  return listLocations();
}

export async function getLocationPath(id: string): Promise<string | null> {
  return locationPathById(id);
}

function readLocationFormData(formData: FormData) {
  return {
    name: formData.get("name"),
    kind: formData.get("kind"),
    addressLine1: formData.get("addressLine1"),
    addressLine2: formData.get("addressLine2"),
    city: formData.get("city"),
    state: formData.get("state"),
    postalCode: formData.get("postalCode"),
    country: formData.get("country"),
    parentLocationId: formData.get("parentLocationId"),
  };
}

async function validateHierarchy(
  input: { kind: LocationSummary["kind"]; parentLocationId?: string },
  currentId?: string,
): Promise<string | null> {
  const requiredParent = parentKindFor(input.kind);
  if (requiredParent) {
    if (!input.parentLocationId) {
      return `Pick a ${LOCATION_KIND_LABELS[requiredParent].toLowerCase()} as the parent.`;
    }
    if (currentId && input.parentLocationId === currentId) {
      return "A location cannot be its own parent.";
    }

    const parent = await getLocationById(input.parentLocationId);
    if (!parent) {
      return "Parent location not found.";
    }
    if (parent.kind !== requiredParent) {
      return `A ${LOCATION_KIND_LABELS[input.kind].toLowerCase()} must sit under a ${LOCATION_KIND_LABELS[requiredParent].toLowerCase()}.`;
    }
  }

  if (currentId) {
    const all = await listLocations();
    if (input.parentLocationId && isDescendant(all, currentId, input.parentLocationId)) {
      return "A location cannot be nested under one of its own children.";
    }
    const children = all.filter((item) => item.parentLocationId === currentId);
    const mismatched = children.find((child) => LOCATION_KIND_PARENT[child.kind] !== input.kind);
    if (mismatched) {
      return `Move or re-level nested ${LOCATION_KIND_LABELS[mismatched.kind].toLowerCase()}s before changing this level.`;
    }
  }
  return null;
}

export async function createLocationAction(
  _prevState: LocationFormState,
  formData: FormData,
): Promise<LocationFormState> {
  if (!(await requireWritableTenant())) {
    return { error: TENANT_READ_ONLY_MESSAGE };
  }
  if (!(await requirePermission("locations", "create"))) {
    return { error: "You don't have permission to create locations." };
  }

  const companyId = headers().get(TENANT_HEADERS.companyId);
  if (!companyId) {
    return { error: "Could not determine your company." };
  }

  const parsed = locationFormSchema.safeParse(readLocationFormData(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const hierarchyError = await validateHierarchy(parsed.data);
  if (hierarchyError) {
    return { error: hierarchyError };
  }

  const result = await createLocation(companyId, parsed.data);
  if ("error" in result) {
    return { error: result.error };
  }

  revalidatePath(ADMIN_PATH);
  revalidatePath("/assets");
  return { error: null };
}

export async function updateLocationAction(
  id: string,
  _prevState: LocationFormState,
  formData: FormData,
): Promise<LocationFormState> {
  if (!(await requireWritableTenant())) {
    return { error: TENANT_READ_ONLY_MESSAGE };
  }
  if (!(await requirePermission("locations", "edit"))) {
    return { error: "You don't have permission to edit locations." };
  }

  const parsed = locationFormSchema.safeParse(readLocationFormData(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const hierarchyError = await validateHierarchy(parsed.data, id);
  if (hierarchyError) {
    return { error: hierarchyError };
  }

  const result = await updateLocation(id, parsed.data);
  if ("error" in result) {
    return { error: result.error };
  }

  revalidatePath(ADMIN_PATH);
  revalidatePath("/assets");
  return { error: null };
}

export async function deleteLocationAction(id: string): Promise<{ error: string | null }> {
  if (!(await requireWritableTenant())) {
    return { error: TENANT_READ_ONLY_MESSAGE };
  }
  if (!(await requirePermission("locations", "delete"))) {
    return { error: "You don't have permission to delete locations." };
  }

  const location = await getLocationById(id);
  if (!location) {
    return { error: "Location not found." };
  }
  if (location.childCount > 0) {
    return { error: "Move or delete nested locations first." };
  }

  const result = await deleteLocation(id);
  revalidatePath(ADMIN_PATH);
  revalidatePath("/assets");
  return result;
}
