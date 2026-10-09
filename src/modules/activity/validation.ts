import { z } from "zod";
import { ACTIVITY_AREAS } from "./types";

export const activityQuerySchema = z.object({
  area: z.enum(ACTIVITY_AREAS).catch("all"),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});
