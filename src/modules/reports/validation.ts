import { z } from "zod";
import { DASHBOARD_PERIODS, REPORT_KEYS } from "./types";

export const dashboardPeriodSchema = z.enum(DASHBOARD_PERIODS).catch("all");

const emptyToUndefined = (value: unknown) => (value === "" || value === null ? undefined : value);
const optionalUuid = () => z.preprocess(emptyToUndefined, z.string().uuid().optional());
const optionalDate = () => z.preprocess(emptyToUndefined, z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional());

export const exportReportSchema = z
  .object({
    reportKey: z.enum(REPORT_KEYS),
    format: z.enum(["csv", "xlsx"]),
    columns: z.array(z.string().min(1).max(60)).min(1, "Pick at least one column.").max(40),
    categoryId: optionalUuid(),
    locationId: optionalUuid(),
    statusId: optionalUuid(),
    from: optionalDate(),
    to: optionalDate(),
    includeArchived: z.boolean(),
  })
  .refine((data) => !data.from || !data.to || data.from <= data.to, {
    message: "The start date must be before the end date.",
    path: ["from"],
  });
