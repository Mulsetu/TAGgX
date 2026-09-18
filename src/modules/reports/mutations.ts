import "server-only";
import { createClient } from "@/lib/supabase/server";

export async function insertImportJob(params: {
  companyId: string;
  createdBy: string | null;
  totalRows: number;
  successCount: number;
  errorCount: number;
  errorReport: string | null;
}): Promise<void> {
  const supabase = createClient();
  await supabase.from("import_jobs").insert({
    company_id: params.companyId,
    created_by: params.createdBy,
    status: "completed",
    total_rows: params.totalRows,
    success_count: params.successCount,
    error_count: params.errorCount,
    error_report: params.errorReport,
  });
}
