import { z } from "zod";
import { REPORT_KEYS } from "./types";

export const exportReportSchema = z.object({
  reportKey: z.enum(REPORT_KEYS),
  format: z.enum(["csv", "xlsx"]),
});

export const IMPORT_COLUMNS = [
  "name",
  "asset_code",
  "category",
  "location",
  "status",
  "condition",
  "serial_number",
  "brand",
  "model",
  "vendor",
  "purchase_date",
  "purchase_price",
  "warranty_end_date",
  "amc_end_date",
  "insurance_expiry_date",
] as const;
