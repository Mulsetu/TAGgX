import { z } from "zod";
import { REPORT_KEYS } from "./types";

export const exportReportSchema = z.object({
  reportKey: z.enum(REPORT_KEYS),
  format: z.enum(["csv", "xlsx"]),
});
