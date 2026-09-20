export const LOCATION_KINDS = ["site", "building", "floor", "room"] as const;
export type LocationKind = (typeof LOCATION_KINDS)[number];

export const LOCATION_KIND_LABELS: Record<LocationKind, string> = {
  site: "Site",
  building: "Building",
  floor: "Floor",
  room: "Room / Zone",
};

/** Company is the tenant itself. Each kind must nest under the previous. */
export const LOCATION_KIND_PARENT: Record<LocationKind, LocationKind | null> = {
  site: null,
  building: "site",
  floor: "building",
  room: "floor",
};

export function isLocationKind(value: string): value is LocationKind {
  return (LOCATION_KINDS as readonly string[]).includes(value);
}

export interface LocationSummary {
  id: string;
  name: string;
  kind: LocationKind;
  path: string;
  depth: number;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  parentLocationId: string | null;
  parentLocationName: string | null;
  childCount: number;
  createdAt: string;
}

export interface LocationOption {
  id: string;
  name: string;
  kind: LocationKind;
}

export interface LocationFormState {
  error: string | null;
}
