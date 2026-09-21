import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isLocationKind, type LocationKind, type LocationOption, type LocationSummary } from "./types";

interface LocationRow {
  id: string;
  name: string;
  kind: string;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  parent_location_id: string | null;
  created_at: string;
}

function toKind(value: string): LocationKind {
  return isLocationKind(value) ? value : "site";
}

function withPaths(rows: LocationRow[]): LocationSummary[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const childCount = new Map<string, number>();
  for (const row of rows) {
    if (row.parent_location_id) {
      childCount.set(row.parent_location_id, (childCount.get(row.parent_location_id) ?? 0) + 1);
    }
  }

  function chain(id: string, seen: Set<string>): LocationRow[] {
    const row = byId.get(id);
    if (!row || seen.has(id)) {
      return [];
    }
    seen.add(id);
    if (!row.parent_location_id) {
      return [row];
    }
    return [...chain(row.parent_location_id, seen), row];
  }

  return rows.map((row) => {
    const ancestors = chain(row.id, new Set());
    const parent = row.parent_location_id ? byId.get(row.parent_location_id) : undefined;
    return {
      id: row.id,
      name: row.name,
      kind: toKind(row.kind),
      path: ancestors.map((entry) => entry.name).join(" / "),
      depth: Math.max(0, ancestors.length - 1),
      addressLine1: row.address_line1,
      addressLine2: row.address_line2,
      city: row.city,
      state: row.state,
      postalCode: row.postal_code,
      country: row.country,
      parentLocationId: row.parent_location_id,
      parentLocationName: parent?.name ?? null,
      childCount: childCount.get(row.id) ?? 0,
      createdAt: row.created_at,
    };
  });
}

const LOCATION_SELECT =
  "id, name, kind, address_line1, address_line2, city, state, postal_code, country, parent_location_id, created_at";

export async function listLocations(): Promise<LocationSummary[]> {
  const supabase = createClient();

  // Explicit cap: PostgREST's own default row limit is a project setting,
  // not something this code should depend on silently. withPaths() below
  // needs every ancestor present to build a location's full path, so this
  // must stay well above any realistic per-company location count.
  const { data, error } = await supabase
    .from("locations")
    .select(LOCATION_SELECT)
    .order("name")
    .limit(5000)
    .returns<LocationRow[]>();

  if (error || !data) {
    return [];
  }

  const items = withPaths(data);
  items.sort((a, b) => a.path.localeCompare(b.path, undefined, { sensitivity: "base" }));
  return items;
}

export async function getLocationById(id: string): Promise<LocationSummary | null> {
  const items = await listLocations();
  return items.find((item) => item.id === id) ?? null;
}

export async function locationPathById(id: string): Promise<string | null> {
  const location = await getLocationById(id);
  return location?.path ?? null;
}

export async function listLocationOptions(): Promise<LocationOption[]> {
  const items = await listLocations();
  return items.map((item) => ({ id: item.id, name: item.path, kind: item.kind }));
}

/** The selected location and every descendant — used when filtering assets by a site/building/floor. */
export async function listLocationAndDescendantIds(locationId: string): Promise<string[]> {
  const items = await listLocations();
  const children = new Map<string, string[]>();
  for (const item of items) {
    if (!item.parentLocationId) {
      continue;
    }
    const list = children.get(item.parentLocationId) ?? [];
    list.push(item.id);
    children.set(item.parentLocationId, list);
  }

  const ids = [locationId];
  const queue = [locationId];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      break;
    }
    for (const child of children.get(current) ?? []) {
      ids.push(child);
      queue.push(child);
    }
  }
  return ids;
}

export function isDescendant(locations: LocationSummary[], ancestorId: string, candidateId: string): boolean {
  const byId = new Map(locations.map((item) => [item.id, item]));
  let current = byId.get(candidateId);
  const seen = new Set<string>();
  while (current?.parentLocationId) {
    if (current.parentLocationId === ancestorId) {
      return true;
    }
    if (seen.has(current.parentLocationId)) {
      return false;
    }
    seen.add(current.parentLocationId);
    current = byId.get(current.parentLocationId);
  }
  return false;
}
