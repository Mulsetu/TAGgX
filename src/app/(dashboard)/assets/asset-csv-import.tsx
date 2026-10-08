"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { downloadFile } from "@/lib/download";
import { importBasicAssetsAction } from "@/modules/reports/actions";
import type { ImportFormState } from "@/modules/reports/types";

const SAMPLE_CSV = [
  "name,category,location,status,condition,brand,model,serial_number",
  "Sample laptop,Your category,Your location,Your status,good,Dell,Latitude,SN-001",
].join("\n");

const initialState: ImportFormState = { error: null };

export function AssetCsvImport() {
  const router = useRouter();
  const [state, setState] = useState<ImportFormState>(initialState);
  const [isPending, startTransition] = useTransition();

  function downloadSample() {
    downloadFile("asset-import-sample.csv", SAMPLE_CSV, "text/csv");
  }

  function handleImport(formData: FormData) {
    startTransition(async () => {
      const result = await importBasicAssetsAction(initialState, formData);
      setState(result);
      if (result.result?.errorCsv) {
        downloadFile("asset-import-errors.csv", result.result.errorCsv, "text/csv");
      }
      if (result.result && result.result.successCount > 0) {
        router.refresh();
      }
    });
  }

  return (
    <section className="flex max-w-2xl flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">Import from CSV</h2>
        <p className="mt-1 text-sm text-slate-500">
          Download the sample, then fill name, category, location, and status. Those names must already exist in Company setup. Asset codes are created from the category prefix. Import stops when the plan asset limit is reached.
        </p>
      </div>
      <Button type="button" variant="outline" size="sm" className="w-fit" onClick={downloadSample}>
        Download sample CSV
      </Button>
      <form action={handleImport} className="flex flex-wrap items-center gap-3">
        <Input name="file" type="file" accept=".csv,text/csv" required className="max-w-xs bg-white" />
        <Button type="submit" disabled={isPending}>
          {isPending ? "Importing..." : "Import assets"}
        </Button>
      </form>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state.result ? (
        <p className="text-sm text-slate-600">
          Imported {state.result.successCount}. {state.result.errorCount > 0 ? `${state.result.errorCount} row(s) were skipped. An error file was downloaded.` : "Every row was added."}
        </p>
      ) : null}
    </section>
  );
}
