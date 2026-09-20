import { z } from "zod";

const emptyToUndefined = (value: unknown) => (value === "" || value === null ? undefined : value);

export const createRoleSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  description: z.preprocess(emptyToUndefined, z.string().trim().max(500).optional()),
});
