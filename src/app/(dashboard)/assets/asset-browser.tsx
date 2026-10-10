"use client";

import Link from "next/link";
import { StatusBadge } from "@/components/assets/status-badge";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ChevronDown,
  Download,
  Activity,
  LayoutGrid,
  List,
  MapPin,
  Plus,
  QrCode,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { downloadQrLabelsPdf } from "@/components/assets/qr-labels-pdf";
import { mediaSrc } from "@/lib/media-url";
import { getQrLabelsAction } from "@/modules/assets/actions";
import { QR_LABEL_LIMIT, type AssetListItem, type AssetOption, type ConditionOption } from "@/modules/assets/types";

interface AssetBrowserProps {
  items: AssetListItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  assetCount: number;
  assetLimit: number | null;
  canCreate: boolean;
  canGenerateQr: boolean;
  atLimit: boolean;
  categories: AssetOption[];
  locations: AssetOption[];
  statuses: AssetOption[];
  vendors: AssetOption[];
  users: AssetOption[];
  conditions: ConditionOption[];
}

const FILTER_KEYS = [
  "q",
  "category",
  "location",
  "status",
  "vendor",
  "custodian",
  "condition",
  "warranty",
  "amc",
  "docs",
  "archived",
] as const;

const MORE_KEYS = ["vendor", "custodian", "condition", "warranty", "amc", "docs", "archived"] as const;

const SORTS = [
  { value: "updated:desc", label: "Recently updated" },
  { value: "created:desc", label: "Recently added" },
  { value: "name:asc", label: "Name A–Z" },
  { value: "name:desc", label: "Name Z–A" },
  { value: "code:asc", label: "Asset code" },
  { value: "purchase:desc", label: "Purchase date" },
] as const;

interface MoreDraft {
  vendor: string;
  custodian: string;
  condition: string;
  warranty: string;
  amc: string;
  docs: string;
  archived: boolean;
}

function readDraft(params: URLSearchParams): MoreDraft {
  return {
    vendor: params.get("vendor") ?? "",
    custodian: params.get("custodian") ?? "",
    condition: params.get("condition") ?? "",
    warranty: params.get("warranty") ?? "",
    amc: params.get("amc") ?? "",
    docs: params.get("docs") ?? "",
    archived: params.get("archived") === "1",
  };
}

function formatUpdated(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export function AssetBrowser({
  items,
  totalCount,
  page,
  pageSize,
  assetCount,
  assetLimit,
  canCreate,
  canGenerateQr,
  atLimit,
  categories,
  locations,
  statuses,
  vendors,
  users,
  conditions,
}: AssetBrowserProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchRef = useRef(searchParams);
  searchRef.current = searchParams;
  const urlQuery = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(urlQuery);
  const [view, setView] = useState<"list" | "grid">("list");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draft, setDraft] = useState<MoreDraft>(() => readDraft(searchParams));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [qrBusy, setQrBusy] = useState(false);
  const [qrMessage, setQrMessage] = useState<{ tone: "info" | "error"; text: string } | null>(null);

  useEffect(() => {
    setQuery(urlQuery);
  }, [urlQuery]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed === (searchRef.current.get("q") ?? "")) return;
    const handle = window.setTimeout(() => {
      const params = new URLSearchParams(searchRef.current.toString());
      if ((params.get("q") ?? "") === trimmed) return;
      if (trimmed) params.set("q", trimmed);
      else params.delete("q");
      params.delete("page");
      const next = params.toString();
      router.push(next ? `${pathname}?${next}` : pathname);
    }, 300);
    return () => window.clearTimeout(handle);
  }, [query, pathname, router]);

  function applyParams(mutate: (params: URLSearchParams) => void, keepPage = false) {
    const params = new URLSearchParams(searchRef.current.toString());
    mutate(params);
    if (!keepPage) params.delete("page");
    const next = params.toString();
    router.push(next ? `${pathname}?${next}` : pathname);
  }

  function updateFilter(key: string, value: string) {
    applyParams((params) => {
      if (value) params.set(key, value);
      else params.delete(key);
    });
  }

  function clearFilters() {
    applyParams((params) => {
      for (const key of FILTER_KEYS) params.delete(key);
    });
    setQuery("");
  }

  const sortKey = searchParams.get("sort") ?? "updated";
  const sortDir = searchParams.get("dir") ?? (sortKey === "name" || sortKey === "code" ? "asc" : "desc");
  const sortValue = `${sortKey}:${sortDir}`;
  const moreCount = MORE_KEYS.filter((key) => searchParams.get(key)).length;
  const chips = useMemo(() => buildChips(searchParams, { categories, locations, statuses, vendors, users, conditions }), [
    searchParams,
    categories,
    locations,
    statuses,
    vendors,
    users,
    conditions,
  ]);
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const allSelected = items.length > 0 && items.every((item) => selected.has(item.id));
  const hasFilters = FILTER_KEYS.some((key) => searchParams.get(key));

  function exportCsv() {
    const header = ["Asset", "Code", "Category", "Location", "Status", "Assigned to", "Last updated"];
    const rows = items.map((asset) =>
      [
        asset.name,
        asset.assetCode,
        asset.categoryName ?? "",
        asset.locationName ?? "",
        asset.statusName,
        asset.allottedToName ?? "Unassigned",
        formatUpdated(asset.updatedAt),
      ].map(csvCell).join(","),
    );
    const blob = new Blob([[header.map(csvCell).join(","), ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "assets.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function generateQrPdf(scope: "selected" | "all") {
    if (qrBusy) return;
    setQrBusy(true);
    setQrMessage({ tone: "info", text: "Preparing QR codes..." });
    try {
      const result = await getQrLabelsAction(
        scope === "selected"
          ? { assetIds: Array.from(selected) }
          : { searchParams: Object.fromEntries(searchParams.entries()) },
      );
      if (result.error || !result.labels) {
        setQrMessage({ tone: "error", text: result.error ?? "Could not generate QR codes." });
        return;
      }
      const stamp = new Date().toISOString().slice(0, 10);
      await downloadQrLabelsPdf(result.labels, `asset-qr-codes-${stamp}.pdf`, (done, total) => {
        setQrMessage({ tone: "info", text: `Building PDF... ${done} of ${total}` });
      });
      setQrMessage({
        tone: "info",
        text: result.truncated
          ? `Downloaded ${result.labels.length} QR codes — the first ${QR_LABEL_LIMIT.toLocaleString("en-IN")}. Narrow the filters to print the rest.`
          : `Downloaded ${result.labels.length} QR code${result.labels.length === 1 ? "" : "s"}.`,
      });
      router.refresh();
    } catch (error) {
      setQrMessage({ tone: "error", text: error instanceof Error ? error.message : "Could not build the PDF." });
    } finally {
      setQrBusy(false);
    }
  }

  function openFilters() {
    setDraft(readDraft(searchParams));
    setFiltersOpen(true);
  }

  function applyMore() {
    applyParams((params) => {
      const pairs: Array<[string, string]> = [
        ["vendor", draft.vendor],
        ["custodian", draft.custodian],
        ["condition", draft.condition],
        ["warranty", draft.warranty],
        ["amc", draft.amc],
        ["docs", draft.docs],
        ["archived", draft.archived ? "1" : ""],
      ];
      for (const [key, value] of pairs) {
        if (value) params.set(key, value);
        else params.delete(key);
      }
    });
    setFiltersOpen(false);
  }

  function clearMore() {
    const empty = { vendor: "", custodian: "", condition: "", warranty: "", amc: "", docs: "", archived: false };
    setDraft(empty);
    applyParams((params) => {
      for (const key of MORE_KEYS) params.delete(key);
    });
    setFiltersOpen(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-[1.7rem] font-semibold tracking-tight text-[#003848]">Assets</h1>
          <p className="text-sm text-slate-500">
            {assetLimit !== null
              ? `${assetCount.toLocaleString("en-IN")} of ${assetLimit.toLocaleString("en-IN")} assets used`
              : `${totalCount.toLocaleString("en-IN")} assets`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
              >
                <Download className="size-4" />
                Export
                <ChevronDown className="size-4 text-slate-400" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-white text-slate-900">
              <DropdownMenuItem onSelect={exportCsv}>Export CSV</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {canGenerateQr ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  disabled={qrBusy || totalCount === 0}
                  className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
                >
                  <QrCode className="size-4" />
                  {qrBusy ? "Generating..." : "QR codes"}
                  <ChevronDown className="size-4 text-slate-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-white text-slate-900">
                <DropdownMenuItem disabled={selected.size === 0} onSelect={() => void generateQrPdf("selected")}>
                  {selected.size > 0 ? `PDF for ${selected.size} selected` : "PDF for selected (select assets first)"}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void generateQrPdf("all")}>
                  {hasFilters ? "PDF for all matching" : "PDF for all"} ({Math.min(totalCount, QR_LABEL_LIMIT).toLocaleString("en-IN")})
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
          {canCreate && atLimit ? (
            <Link
              href="/dashboard/administration/settings"
              className="inline-flex h-10 items-center rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700"
            >
              Get more assets
            </Link>
          ) : canCreate ? (
            <Link
              href="/assets/new"
              className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
            >
              <Plus className="size-4" />
              Add Asset
            </Link>
          ) : null}
        </div>
      </div>

      {qrMessage ? (
        <p
          role={qrMessage.tone === "error" ? "alert" : "status"}
          className={`text-sm ${qrMessage.tone === "error" ? "text-destructive" : "text-slate-600"}`}
        >
          {qrMessage.text}
        </p>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="relative block">
          <span className="sr-only">Search assets</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by asset name, code, serial number..."
            className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-[hsl(var(--brand-primary))] focus:ring-2 focus:ring-[hsl(var(--brand-primary)/0.15)]"
          />
        </label>
        <div className="mt-3 flex flex-col gap-2 lg:flex-row">
          <FilterSelect
            label="Location"
            icon={<MapPin className="size-4" />}
            value={searchParams.get("location") ?? ""}
            onChange={(value) => updateFilter("location", value)}
          >
            <option value="">All locations</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>{location.name}</option>
            ))}
          </FilterSelect>
          <FilterSelect
            label="Category"
            icon={<LayoutGrid className="size-4" />}
            value={searchParams.get("category") ?? ""}
            onChange={(value) => updateFilter("category", value)}
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </FilterSelect>
          <FilterSelect
            label="Status"
            icon={<Activity className="size-4" />}
            value={searchParams.get("status") ?? ""}
            onChange={(value) => updateFilter("status", value)}
          >
            <option value="">All statuses</option>
            {statuses.map((status) => (
              <option key={status.id} value={status.id}>{status.name}</option>
            ))}
          </FilterSelect>
          <button
            type="button"
            onClick={openFilters}
            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-primary/30 bg-white px-4 text-sm font-medium text-primary hover:bg-primary/5"
          >
            <SlidersHorizontal className="size-4" />
            More filters
            {moreCount > 0 ? (
              <span className="grid size-5 place-items-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
                {moreCount}
              </span>
            ) : null}
          </button>
        </div>
        {chips.length > 0 ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-slate-500">Active filters:</span>
            {chips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={() => {
                  if (chip.key === "q") setQuery("");
                  updateFilter(chip.key, "");
                }}
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-primary"
              >
                {chip.label}
                <X className="size-3.5" />
              </button>
            ))}
            <button type="button" onClick={clearFilters} className="font-medium text-primary hover:underline">
              Clear all
            </button>
          </div>
        ) : null}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-base font-semibold text-slate-800">Assets ({totalCount.toLocaleString("en-IN")})</h2>
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-600">
              <span>Sort:</span>
              <select
                aria-label="Sort assets"
                value={SORTS.some((option) => option.value === sortValue) ? sortValue : "updated:desc"}
                onChange={(event) => {
                  const [sort, dir] = event.target.value.split(":");
                  if (!sort || !dir) return;
                  applyParams((params) => {
                    if (sort === "updated" && dir === "desc") {
                      params.delete("sort");
                      params.delete("dir");
                    } else {
                      params.set("sort", sort);
                      params.set("dir", dir);
                    }
                  });
                }}
                className="bg-transparent font-medium text-slate-800 outline-none"
              >
                {SORTS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            {/* Phones always get cards (below), so the toggle only matters from md up. */}
            <div className="hidden h-9 overflow-hidden rounded-lg border border-slate-200 md:inline-flex">
              <button
                type="button"
                aria-label="List view"
                aria-pressed={view === "list"}
                onClick={() => setView("list")}
                className={`grid w-9 place-items-center ${view === "list" ? "bg-primary text-primary-foreground" : "bg-white text-slate-500"}`}
              >
                <List className="size-4" />
              </button>
              <button
                type="button"
                aria-label="Grid view"
                aria-pressed={view === "grid"}
                onClick={() => setView("grid")}
                className={`grid w-9 place-items-center ${view === "grid" ? "bg-primary text-primary-foreground" : "bg-white text-slate-500"}`}
              >
                <LayoutGrid className="size-4" />
              </button>
            </div>
            <label className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700">
              <select
                aria-label="Rows per page"
                value={String(pageSize)}
                onChange={(event) => {
                  const size = event.target.value;
                  applyParams((params) => {
                    if (size === "10") params.delete("pageSize");
                    else params.set("pageSize", size);
                  });
                }}
                className="bg-transparent outline-none"
              >
                <option value="10">10 / page</option>
                <option value="25">25 / page</option>
                <option value="50">50 / page</option>
              </select>
            </label>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-sm font-medium text-slate-800">{hasFilters ? "No assets match these filters." : "No assets yet."}</p>
            <p className="mt-1 text-sm text-slate-500">
              {hasFilters
                ? "Clear a filter to see more of the inventory."
                : canCreate
                  ? "Add the first asset to start tracking equipment."
                  : "Ask an administrator to add assets for this company."}
            </p>
          </div>
        ) : (
          <>
          <ul className={`grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3 ${view === "list" ? "md:hidden" : ""}`}>
            {items.map((asset) => (
              <li key={asset.id} className="rounded-xl border border-slate-200 p-3">
                <Link href={`/assets/${asset.id}`} className="flex gap-3">
                  <AssetThumb asset={asset} />
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-slate-900">{asset.name}</span>
                    <span className="block text-xs text-slate-500">{asset.assetCode}</span>
                    <span className="mt-1 block truncate text-xs text-[hsl(var(--brand-primary))]">{asset.categoryName ?? "—"}</span>
                    <StatusBadge name={asset.statusName} color={asset.statusColor} className="mt-2" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {view === "list" ? (
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-medium text-slate-500">
                <tr>
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      aria-label="Select all assets on this page"
                      checked={allSelected}
                      onChange={(event) => {
                        setSelected(event.target.checked ? new Set(items.map((item) => item.id)) : new Set());
                      }}
                      className="size-4 rounded border-slate-300"
                    />
                  </th>
                  <th className="px-3 py-3 font-medium">Asset</th>
                  <th className="px-3 py-3 font-medium">Category</th>
                  <th className="px-3 py-3 font-medium">Location</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 font-medium">Assigned to</th>
                  <th className="px-3 py-3 font-medium">Last updated</th>
                </tr>
              </thead>
              <tbody>
                {items.map((asset) => (
                  <tr
                    key={asset.id}
                    className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
                    onClick={() => router.push(`/assets/${asset.id}`)}
                  >
                    <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label={`Select ${asset.name}`}
                        checked={selected.has(asset.id)}
                        onChange={(event) => {
                          setSelected((current) => {
                            const next = new Set(current);
                            if (event.target.checked) next.add(asset.id);
                            else next.delete(asset.id);
                            return next;
                          });
                        }}
                        className="size-4 rounded border-slate-300"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <Link href={`/assets/${asset.id}`} className="flex items-center gap-3">
                        <AssetThumb asset={asset} />
                        <span className="min-w-0">
                          <span className="block font-medium text-slate-900">{asset.name}</span>
                          <span className="block text-xs text-slate-500">{asset.assetCode}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-3 py-3 font-medium text-[hsl(var(--brand-primary))]">{asset.categoryName ?? "—"}</td>
                    <td className="px-3 py-3 text-slate-600">
                      <span className="inline-flex items-start gap-1.5">
                        <MapPin className="mt-0.5 size-3.5 shrink-0 text-slate-400" />
                        <span>{asset.locationName ?? "—"}</span>
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge name={asset.statusName} color={asset.statusColor} />
                    </td>
                    <td className="px-3 py-3 text-slate-500">{asset.allottedToName ? asset.allottedToName : "— Unassigned"}</td>
                    <td className="px-3 py-3 text-slate-600">{formatUpdated(asset.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          ) : null}
          </>
        )}

        {totalPages > 1 ? (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
            <span>Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => applyParams((params) => {
                  if (page - 1 <= 1) params.delete("page");
                  else params.set("page", String(page - 1));
                }, true)}
                className="h-9 rounded-lg border border-slate-200 bg-white px-3 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => applyParams((params) => params.set("page", String(page + 1)), true)}
                className="h-9 rounded-lg border border-slate-200 bg-white px-3 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </section>

      {filtersOpen ? (
        <div className="fixed inset-0 z-50">
          <button type="button" aria-label="Close filters" className="absolute inset-0 bg-slate-900/20" onClick={() => setFiltersOpen(false)} />
          <aside role="dialog" aria-labelledby="more-filters-title" className="absolute inset-y-0 right-0 flex w-full max-w-sm flex-col bg-white text-slate-900 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 id="more-filters-title" className="text-lg font-semibold">More filters</h2>
              <button type="button" aria-label="Close" onClick={() => setFiltersOpen(false)} className="grid size-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100">
                <X className="size-4" />
              </button>
            </div>
            <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
              <Field label="Vendor">
                <NativeField value={draft.vendor} onChange={(value) => setDraft((current) => ({ ...current, vendor: value }))}>
                  <option value="">All vendors</option>
                  {vendors.map((vendor) => (
                    <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
                  ))}
                </NativeField>
              </Field>
              <Field label="Custodian">
                <NativeField value={draft.custodian} onChange={(value) => setDraft((current) => ({ ...current, custodian: value }))}>
                  <option value="">All custodians</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>{user.name}</option>
                  ))}
                </NativeField>
              </Field>
              <Field label="Condition">
                <NativeField value={draft.condition} onChange={(value) => setDraft((current) => ({ ...current, condition: value }))}>
                  <option value="">All conditions</option>
                  {conditions.map((condition) => (
                    <option key={condition.key} value={condition.key}>{condition.name}</option>
                  ))}
                </NativeField>
              </Field>
              <Field label="Warranty">
                <NativeField value={draft.warranty} onChange={(value) => setDraft((current) => ({ ...current, warranty: value }))}>
                  <option value="">Any</option>
                  <option value="active">Active</option>
                  <option value="expired">Expired</option>
                  <option value="none">None</option>
                </NativeField>
              </Field>
              <Field label="AMC">
                <NativeField value={draft.amc} onChange={(value) => setDraft((current) => ({ ...current, amc: value }))}>
                  <option value="">Any</option>
                  <option value="active">Active</option>
                  <option value="expired">Expired</option>
                  <option value="none">None</option>
                </NativeField>
              </Field>
              <Field label="Documents">
                <NativeField value={draft.docs} onChange={(value) => setDraft((current) => ({ ...current, docs: value }))}>
                  <option value="">Any</option>
                  <option value="expired">Expired</option>
                  <option value="expiring">Expiring soon</option>
                  <option value="none">None</option>
                </NativeField>
              </Field>
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={draft.archived}
                  onChange={(event) => setDraft((current) => ({ ...current, archived: event.target.checked }))}
                  className="size-4 rounded border-slate-300"
                />
                Include archived
              </label>
            </div>
            <div className="flex gap-3 border-t border-slate-100 px-5 py-4">
              <button type="button" onClick={clearMore} className="h-11 flex-1 rounded-xl border border-slate-200 text-sm font-medium text-slate-700">
                Clear all
              </button>
              <button type="button" onClick={applyMore} className="h-11 flex-1 rounded-xl bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90">
                Apply filters
              </button>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}

function AssetThumb({ asset }: { asset: AssetListItem }) {
  const src = mediaSrc(asset.imageUrl);
  if (!src) {
    return <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-slate-100 text-[10px] font-medium text-slate-400">IMG</span>;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className="size-10 shrink-0 rounded-lg object-cover" />
  );
}

function FilterSelect({
  label,
  icon,
  value,
  onChange,
  children,
}: {
  label: string;
  icon: ReactNode;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="relative min-w-0 flex-1">
      <span className="sr-only">{label}</span>
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{icon}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-10 pr-8 text-sm text-slate-700 outline-none focus:border-[hsl(var(--brand-primary))] focus:ring-2 focus:ring-[hsl(var(--brand-primary)/0.15)]"
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
    </label>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function NativeField({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <span className="relative block">
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 pr-8 text-sm text-slate-700 outline-none focus:border-[hsl(var(--brand-primary))]"
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
    </span>
  );
}

function buildChips(
  params: URLSearchParams,
  options: {
    categories: AssetOption[];
    locations: AssetOption[];
    statuses: AssetOption[];
    vendors: AssetOption[];
    users: AssetOption[];
    conditions: ConditionOption[];
  },
): Array<{ key: string; label: string }> {
  const chips: Array<{ key: string; label: string }> = [];
  const named = (key: string, list: AssetOption[]) => {
    const id = params.get(key);
    if (!id) return;
    chips.push({ key, label: list.find((item) => item.id === id)?.name ?? "Selected" });
  };
  named("location", options.locations);
  named("status", options.statuses);
  named("category", options.categories);
  named("vendor", options.vendors);
  named("custodian", options.users);
  const condition = params.get("condition");
  if (condition) {
    chips.push({ key: "condition", label: options.conditions.find((item) => item.key === condition)?.name ?? condition });
  }
  const warranty = params.get("warranty");
  if (warranty) chips.push({ key: "warranty", label: `Warranty: ${warranty}` });
  const amc = params.get("amc");
  if (amc) chips.push({ key: "amc", label: `AMC: ${amc}` });
  const docs = params.get("docs");
  if (docs) chips.push({ key: "docs", label: `Documents: ${docs}` });
  if (params.get("archived") === "1") chips.push({ key: "archived", label: "Include archived" });
  const q = params.get("q");
  if (q) chips.push({ key: "q", label: q });
  return chips;
}
