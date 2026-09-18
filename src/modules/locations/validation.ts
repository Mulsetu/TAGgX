import { z } from "zod";
import { LOCATION_KIND_PARENT, LOCATION_KINDS, type LocationKind } from "./types";

const emptyToUndefined = (value: unknown) => (value === "" || value === null ? undefined : value);
const optionalString = (max: number) =>
  z.preprocess(emptyToUndefined, z.string().trim().max(max).optional());

export const locationFormSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(200),
    kind: z.enum(LOCATION_KINDS),
    addressLine1: optionalString(200),
    addressLine2: optionalString(200),
    city: optionalString(100),
    state: optionalString(100),
    postalCode: optionalString(20),
    country: optionalString(100),
    parentLocationId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  })
  .superRefine((value, ctx) => {
    const requiredParent = LOCATION_KIND_PARENT[value.kind];
    if (requiredParent && !value.parentLocationId) {
      ctx.addIssue({
        code: "custom",
        message: `A ${value.kind === "room" ? "room / zone" : value.kind} must sit under a ${requiredParent}.`,
        path: ["parentLocationId"],
      });
    }
    if (!requiredParent && value.parentLocationId) {
      ctx.addIssue({
        code: "custom",
        message: "A site sits directly under the company — don't pick a parent.",
        path: ["parentLocationId"],
      });
    }
  });

export type LocationFormInput = z.infer<typeof locationFormSchema>;

export function parentKindFor(kind: LocationKind): LocationKind | null {
  return LOCATION_KIND_PARENT[kind];
}
