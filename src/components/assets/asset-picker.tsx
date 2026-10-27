"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { searchAssetOptionsAction } from "@/modules/assets/actions";
import type { AssetOption } from "@/modules/assets/types";

interface AssetPickerProps {
  id: string;
  name: string;
  /** Already-chosen asset, e.g. the current parent when editing. */
  initial?: AssetOption | null;
  /** Leaves this asset out of the results (an asset can't be its own parent). */
  excludeAssetId?: string;
  required?: boolean;
  placeholder?: string;
}

const DEBOUNCE_MS = 250;

/**
 * Search-as-you-type asset field. Fetches up to 20 matches per query instead
 * of shipping every asset to the browser, so it stays fast however large the
 * workspace grows. Submits the chosen asset's id under `name`.
 */
export function AssetPicker({ id, name, initial = null, excludeAssetId, required, placeholder = "Search by name or code" }: AssetPickerProps) {
  const listId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef(0);
  const [selected, setSelected] = useState<AssetOption | null>(initial);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<AssetOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (!open) return;
    const request = ++requestRef.current;
    setLoading(true);
    const timer = window.setTimeout(async () => {
      const next = await searchAssetOptionsAction(query, excludeAssetId);
      // Ignore answers to older keystrokes that arrive late.
      if (request === requestRef.current) {
        setResults(next);
        setActive(0);
        setLoading(false);
      }
    }, query ? DEBOUNCE_MS : 0);
    return () => window.clearTimeout(timer);
  }, [open, query, excludeAssetId]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // Clear back to the initial value when the surrounding form is reset.
  useEffect(() => {
    const form = containerRef.current?.closest("form");
    if (!form) return;
    const onReset = () => {
      setSelected(initial);
      setQuery("");
    };
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, [initial]);

  function choose(option: AssetOption) {
    setSelected(option);
    setQuery("");
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Visually hidden but focusable-for-validation, so `required` blocks submit like a normal field. */}
      <input
        tabIndex={-1}
        aria-hidden="true"
        name={name}
        value={selected?.id ?? ""}
        required={required}
        onChange={() => undefined}
        onInvalid={() => setOpen(true)}
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px opacity-0"
      />
      {selected ? (
        <div className="flex h-10 items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-sm">
          <span className="truncate">{selected.name}</span>
          <button
            type="button"
            onClick={() => {
              setSelected(null);
              setOpen(true);
            }}
            className="grid size-6 shrink-0 place-items-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label={`Clear ${selected.name}`}
          >
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            id={id}
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            autoComplete="off"
            value={query}
            placeholder={placeholder}
            onFocus={() => setOpen(true)}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setOpen(true);
                setActive((index) => Math.min(index + 1, results.length - 1));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setActive((index) => Math.max(index - 1, 0));
              } else if (event.key === "Enter" && open) {
                const option = results[active];
                if (option) {
                  event.preventDefault();
                  choose(option);
                }
              } else if (event.key === "Escape") {
                setOpen(false);
              }
            }}
            className="flex h-10 w-full rounded-md border border-input bg-background py-2 pl-9 pr-9 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
          {loading && open ? (
            <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-slate-400" />
          ) : null}
        </div>
      )}

      {open && !selected ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg"
        >
          {results.length === 0 && !loading ? (
            <li className="px-3 py-2 text-slate-500">{query ? "No matching assets." : "No assets yet."}</li>
          ) : (
            results.map((option, index) => (
              <li
                key={option.id}
                role="option"
                aria-selected={index === active}
                onPointerDown={(event) => {
                  event.preventDefault();
                  choose(option);
                }}
                onMouseEnter={() => setActive(index)}
                className={cn("cursor-pointer truncate px-3 py-2", index === active ? "bg-slate-100" : "hover:bg-slate-50")}
              >
                {option.name}
              </li>
            ))
          )}
          {results.length >= 20 ? (
            <li className="border-t border-slate-100 px-3 py-1.5 text-xs text-slate-400">Showing the first 20. Type to narrow down.</li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
