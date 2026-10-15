"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { downloadFile } from "@/lib/download";
import { toCsv } from "@/lib/csv";
import { getAssetImportTemplateAction, importAssetsCsvAction } from "@/modules/assets/actions";
import type { AssetImportColumn, AssetImportState, AssetImportTemplate } from "@/modules/assets/types";

const initialState: AssetImportState = { error: null };
const EMPTY_TEMPLATE: AssetImportTemplate = { core: [], fields: [], categories: [] };

function lockedColumns(template: AssetImportTemplate): Set<string> {
  return new Set([...template.core, ...template.fields.filter((field) => field.required)].map((c) => c.column));
}

function ColumnCheckbox({
  column,
  checked,
  locked,
  onToggle,
}: {
  column: AssetImportColumn;
  checked: boolean;
  locked: boolean;
  onToggle: (column: string) => void;
}) {
  return (
    <label
      className={`flex items-start gap-2 rounded-lg border px-2.5 py-2 text-sm ${
        checked ? "border-[hsl(var(--brand-primary)/0.4)] bg-[hsl(var(--brand-primary)/0.05)]" : "border-slate-200 bg-white"
      } ${locked ? "cursor-default" : "cursor-pointer hover:border-slate-300"}`}
    >
      <input
        type="checkbox"
        className="mt-0.5 size-4 rounded border-slate-300"
        checked={checked}
        disabled={locked}
        onChange={() => onToggle(column.column)}
      />
      <span className="min-w-0">
        <span className="flex items-center gap-1 font-medium text-slate-800">
          {column.label}
          {locked ? <Lock className="size-3 text-slate-400" aria-label="Always included" /> : null}
        </span>
        <span className="block truncate font-mono text-[11px] text-slate-500">{column.column}</span>
        {column.hint ? <span className="block text-[11px] text-slate-400">{column.hint}</span> : null}
      </span>
    </label>
  );
}

/**
 * The column template (catalogs + custom fields) is only needed once someone
 * opens the picker or downloads the sample, so it is fetched on demand
 * rather than on every /assets/new render.
 */
export function AssetCsvImport() {
  const router = useRouter();
  const [state, setState] = useState<AssetImportState>(initialState);
  const [isPending, startTransition] = useTransition();
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [loadedTemplate, setLoadedTemplate] = useState<AssetImportTemplate | null>(null);
  const [templateLoading, setTemplateLoading] = useState(false);
  const templateRequest = useRef<Promise<AssetImportTemplate> | null>(null);
  const template = loadedTemplate ?? EMPTY_TEMPLATE;

  const locked = useMemo(() => lockedColumns(template), [template]);

  function loadTemplate(): Promise<AssetImportTemplate> {
    if (loadedTemplate) {
      return Promise.resolve(loadedTemplate);
    }
    if (!templateRequest.current) {
      setTemplateLoading(true);
      templateRequest.current = getAssetImportTemplateAction()
        .then((loaded) => {
          setLoadedTemplate(loaded);
          return loaded;
        })
        .catch((error: unknown) => {
          // Let the next click retry instead of caching the failure.
          templateRequest.current = null;
          throw error;
        })
        .finally(() => setTemplateLoading(false));
    }
    return templateRequest.current;
  }

  async function togglePicker() {
    if (!pickerOpen) {
      try {
        await loadTemplate();
      } catch {
        setState({ error: "Couldn't load the import columns. Please try again." });
        return;
      }
    }
    setPickerOpen((open) => !open);
  }

  function toggle(column: string) {
    setChosen((current) => {
      const next = new Set(current);
      if (next.has(column)) next.delete(column);
      else next.add(column);
      return next;
    });
  }

  function setMany(columns: AssetImportColumn[], on: boolean) {
    setChosen((current) => {
      const next = new Set(current);
      for (const column of columns) {
        if (locked.has(column.column)) continue;
        if (on) next.add(column.column);
        else next.delete(column.column);
      }
      return next;
    });
  }

  async function downloadSample() {
    let current: AssetImportTemplate;
    try {
      current = await loadTemplate();
    } catch {
      setState({ error: "Couldn't load the import columns. Please try again." });
      return;
    }
    // Read from `current`, not render state: on the first click the template
    // has only just arrived and this render's `template` is still empty.
    const required = lockedColumns(current);
    const ordered: AssetImportColumn[] = [
      ...current.core,
      ...current.fields.filter((field) => required.has(field.column) || chosen.has(field.column)),
    ];
    const seen = new Set(ordered.map((column) => column.column));
    // Example row's category: the first one whose fields were ticked, so its sample values line up.
    const exampleCategory = current.categories.find((group) => group.columns.some((c) => chosen.has(c.column)));
    for (const group of current.categories) {
      for (const column of group.columns) {
        if (chosen.has(column.column) && !seen.has(column.column)) {
          seen.add(column.column);
          ordered.push(column);
        }
      }
    }
    const exampleColumns = new Set(exampleCategory?.columns.map((column) => column.column));
    const row = ordered.map((column) => {
      if (column.column === "category" && exampleCategory) return exampleCategory.categoryName;
      if (column.column.startsWith("custom_")) return exampleColumns.has(column.column) ? column.example : "";
      return column.example;
    });
    downloadFile("asset-import-sample.csv", toCsv([ordered.map((column) => column.column), row]), "text/csv");
  }

  function handleImport(formData: FormData) {
    startTransition(async () => {
      const result = await importAssetsCsvAction(initialState, formData);
      setState(result);
      if (result.result?.errorCsv) {
        downloadFile("asset-import-errors.csv", result.result.errorCsv, "text/csv");
      }
      if (result.result && result.result.successCount > 0) {
        router.refresh();
      }
    });
  }

  const optionalFields = template.fields.filter((field) => !field.required);
  const requiredFields = template.fields.filter((field) => field.required);
  const extraCount = chosen.size;

  return (
    <section className="flex max-w-3xl flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">Import from CSV</h2>
        <p className="mt-1 text-sm text-slate-500">
          Pick the columns you need, download the sample, and fill one row per asset. Category, location, status, and
          vendor names must already exist in Company setup. Asset codes are created from the category prefix. Import
          stops when the plan asset limit is reached.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={togglePicker} disabled={templateLoading}>
          {pickerOpen ? "Hide columns" : templateLoading ? "Loading..." : "Choose columns"}
        </Button>
        <Button type="button" size="sm" onClick={downloadSample} disabled={templateLoading}>
          Download sample CSV
        </Button>
        {loadedTemplate ? (
          <span className="text-xs text-slate-500">
            {template.core.length + requiredFields.length} required
            {extraCount > 0 ? ` + ${extraCount} chosen` : ""} column{template.core.length + requiredFields.length + extraCount === 1 ? "" : "s"}
          </span>
        ) : null}
      </div>

      {pickerOpen ? (
        <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Always included</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {[...template.core, ...requiredFields].map((column) => (
                <ColumnCheckbox key={column.column} column={column} checked locked onToggle={toggle} />
              ))}
            </div>
          </div>

          {optionalFields.length > 0 ? (
            <div>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Asset fields</p>
                <span className="flex gap-2 text-xs">
                  <button type="button" className="text-[hsl(var(--brand-primary))] hover:underline" onClick={() => setMany(optionalFields, true)}>
                    Select all
                  </button>
                  <button type="button" className="text-slate-500 hover:underline" onClick={() => setMany(optionalFields, false)}>
                    Clear
                  </button>
                </span>
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {optionalFields.map((column) => (
                  <ColumnCheckbox
                    key={column.column}
                    column={column}
                    checked={chosen.has(column.column)}
                    locked={false}
                    onToggle={toggle}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {template.categories.map((group) => (
            <div key={group.categoryName}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {group.categoryName} fields
                </p>
                <span className="flex gap-2 text-xs">
                  <button type="button" className="text-[hsl(var(--brand-primary))] hover:underline" onClick={() => setMany(group.columns, true)}>
                    Select all
                  </button>
                  <button type="button" className="text-slate-500 hover:underline" onClick={() => setMany(group.columns, false)}>
                    Clear
                  </button>
                </span>
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {group.columns.map((column) => (
                  <ColumnCheckbox
                    key={`${group.categoryName}-${column.column}`}
                    column={column.required ? { ...column, hint: `Required for ${group.categoryName}` } : column}
                    checked={chosen.has(column.column)}
                    locked={false}
                    onToggle={toggle}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <form action={handleImport} className="flex flex-wrap items-center gap-3">
        <Input name="file" type="file" accept=".csv,text/csv" required className="max-w-xs bg-white" />
        <Button type="submit" disabled={isPending}>
          {isPending ? "Importing..." : "Import assets"}
        </Button>
      </form>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state.result ? (
        <p className="text-sm text-slate-600">
          Imported {state.result.successCount}.{" "}
          {state.result.errorCount > 0
            ? `${state.result.errorCount} row(s) were skipped. An error file was downloaded.`
            : "Every row was added."}
        </p>
      ) : null}
    </section>
  );
}
