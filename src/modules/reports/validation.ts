import { z } from "zod";
import { DASHBOARD_PERIODS, REPORT_KEYS } from "./types";

export const dashboardPeriodSchema = z.enum(DASHBOARD_PERIODS).catch("all");

export const exportReportSchema = z.object({
  reportKey: z.enum(REPORT_KEYS),
  format: z.enum(["csv", "xlsx"]),
});
