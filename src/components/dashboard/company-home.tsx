import type { ReactNode } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Box,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  MapPin,
  MoreHorizontal,
  PieChart,
  Plus,
  Wrench,
} from "lucide-react";
import { DonutChart } from "@/components/charts/donut-chart";
import { SimpleBarChart } from "@/components/charts/simple-bar-chart";
import { mediaSrc } from "@/lib/media-url";
import type { RecentAsset } from "@/modules/assets/types";
import type { DashboardHomeWidget } from "@/modules/reports/types";

const STAT_ORDER = [
  "total_assets",
  "active_assets",
  "missing_assets",
  "unassigned_assets",
  "assets_under_maintenance",
] as const;

const CHART_ORDER = ["by_location", "by_category", "by_status"] as const;

const STAT_META: Record<
  (typeof STAT_ORDER)[number],
  { label: string; icon: typeof Box; wrap: string }
> = {
  total_assets: { label: "Total assets", icon: Box, wrap: "bg-sky-50 text-sky-600" },
  active_assets: { label: "Active assets", icon: CheckCircle2, wrap: "bg-emerald-50 text-emerald-600" },
  missing_assets: { label: "Missing location", icon: MapPin, wrap: "bg-sky-50 text-sky-600" },
  unassigned_assets: { label: "Unassigned assets", icon: AlertCircle, wrap: "bg-amber-50 text-amber-600" },
  assets_under_maintenance: { label: "Under maintenance", icon: Wrench, wrap: "bg-violet-50 text-violet-600" },
};

function PeriodChip() {
  return (
    <span className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600">
      <CalendarDays className="size-3.5 text-slate-400" />
      Last 30 days
      <ChevronDown className="size-3.5 text-slate-400" />
    </span>
  );
}

function Trend({ percent }: { percent: number }) {
  const up = percent >= 0;
  return (
    <p className={`mt-3 flex items-center gap-1 text-xs font-medium ${up ? "text-emerald-600" : "text-rose-600"}`}>
      <span aria-hidden>{up ? "↑" : "↓"}</span>
      {Math.abs(percent)}%
      <span className="font-normal text-slate-400">vs last month</span>
    </p>
  );
}

function statusClass(name: string): string {
  const value = name.toLowerCase();
  if (value.includes("active")) return "bg-emerald-50 text-emerald-700";
  if (value.includes("missing")) return "bg-sky-50 text-sky-700";
  if (value.includes("maint")) return "bg-violet-50 text-violet-700";
  if (value.includes("unassign")) return "bg-amber-50 text-amber-700";
  return "bg-slate-100 text-slate-600";
}

function formatUpdated(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function Panel({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex min-w-0 flex-col rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          {icon}
          {title}
        </h2>
        <PeriodChip />
      </div>
      {children}
    </section>
  );
}

export function CompanyHome({
  widgets,
  recentAssets,
  trendPercent,
  canCreate,
}: {
  widgets: DashboardHomeWidget[];
  recentAssets: RecentAsset[];
  trendPercent: number;
  canCreate: boolean;
}) {
  const byId = new Map(widgets.map((widget) => [widget.id, widget]));
  const stats = STAT_ORDER.flatMap((id) => {
    const widget = byId.get(id);
    return widget ? [widget] : [];
  });
  const charts = CHART_ORDER.flatMap((id) => {
    const widget = byId.get(id);
    return widget ? [widget] : [];
  });
  const featured = new Set<string>([...STAT_ORDER, ...CHART_ORDER]);
  const extras = widgets.filter((widget) => !featured.has(widget.id));
  const category = byId.get("by_category");
  const status = byId.get("by_status");
  const location = byId.get("by_location");

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-[1.65rem] font-semibold tracking-tight text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500">Overview of your company&apos;s asset management.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600 shadow-sm">
            <CalendarDays className="size-4 text-slate-400" />
            Last 30 days
            <ChevronDown className="size-4 text-slate-400" />
          </span>
          {canCreate ? (
            <Link
              href="/assets/new"
              className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
            >
              <Plus className="size-4" />
              Add Asset
            </Link>
          ) : null}
        </div>
      </div>

      {stats.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {stats.map((widget) => {
            const meta = STAT_META[widget.id as (typeof STAT_ORDER)[number]];
            const Icon = meta.icon;
            return (
              <Link
                key={widget.id}
                href={widget.href}
                className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:border-slate-300"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm text-slate-500">{meta.label}</p>
                  <span className={`flex size-9 items-center justify-center rounded-xl ${meta.wrap}`}>
                    <Icon className="size-4" />
                  </span>
                </div>
                <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{widget.value ?? 0}</p>
                <Trend percent={widget.id === "total_assets" ? trendPercent : 0} />
              </Link>
            );
          })}
        </div>
      ) : null}

      {charts.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
          {location ? (
            <Panel title="Assets by location" icon={<MapPin className="size-4 text-[hsl(var(--brand-primary))]" />}>
              {location.chart.length === 0 ? (
                <p className="flex h-[220px] items-center justify-center text-sm text-slate-400">No data yet</p>
              ) : (
                <SimpleBarChart data={location.chart} />
              )}
            </Panel>
          ) : null}
          {category ? (
            <Panel title="Assets by category" icon={<Box className="size-4 text-[hsl(var(--brand-primary))]" />}>
              {category.chart.length === 0 ? (
                <p className="flex h-40 items-center justify-center text-sm text-slate-400">No data yet</p>
              ) : (
                <DonutChart
                  data={category.chart}
                  centerValue={String(category.chart.reduce((sum, item) => sum + item.value, 0))}
                  centerLabel="Total Assets"
                />
              )}
            </Panel>
          ) : null}
          {status ? (
            <Panel title="Assets by status" icon={<PieChart className="size-4 text-primary" />}>
              {status.chart.length === 0 ? (
                <p className="flex h-40 items-center justify-center text-sm text-slate-400">No data yet</p>
              ) : (
                <DonutChart
                  data={status.chart}
                  centerValue={String(status.chart.reduce((sum, item) => sum + item.value, 0))}
                  centerLabel="Total Assets"
                />
              )}
            </Panel>
          ) : null}
        </div>
      ) : null}

      <section className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-800">Recent assets</h2>
          <Link href="/assets" className="text-sm font-medium text-[hsl(var(--brand-primary))] hover:underline">
            View all →
          </Link>
        </div>
        {recentAssets.length === 0 ? (
          <p className="px-5 pb-6 text-sm text-slate-400">No assets yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-y border-slate-100 text-left text-xs text-slate-400">
                  <th className="px-5 py-3 font-medium">Asset ID</th>
                  <th className="px-3 py-3 font-medium">Asset name</th>
                  <th className="px-3 py-3 font-medium">Category</th>
                  <th className="px-3 py-3 font-medium">Location</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 font-medium">Assigned to</th>
                  <th className="px-3 py-3 font-medium">Last updated</th>
                  <th className="px-5 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {recentAssets.map((asset) => {
                  const image = mediaSrc(asset.imageUrl);
                  return (
                    <tr key={asset.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-5 py-3">
                        <span className="flex items-center gap-3">
                          <span className="flex size-9 items-center justify-center overflow-hidden rounded-lg bg-slate-100 text-slate-400">
                            {image ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={image} alt="" className="size-full object-cover" />
                            ) : (
                              <Box className="size-4" />
                            )}
                          </span>
                          <span className="font-medium text-slate-800">{asset.assetCode}</span>
                        </span>
                      </td>
                      <td className="px-3 py-3 text-slate-700">{asset.name}</td>
                      <td className="px-3 py-3">
                        {asset.categoryName ? (
                          <span className="text-[hsl(var(--brand-primary))]">{asset.categoryName}</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-slate-600">{asset.locationName ?? "—"}</td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${statusClass(asset.statusName)}`}>
                          <span className="size-1.5 rounded-full bg-current" />
                          {asset.statusName}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-slate-600">{asset.allottedToName ?? "Unassigned"}</td>
                      <td className="px-3 py-3 text-slate-500">{formatUpdated(asset.updatedAt)}</td>
                      <td className="px-5 py-3 text-right">
                        <Link
                          href={`/assets/${asset.id}`}
                          className="inline-flex size-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          aria-label={`Open ${asset.name}`}
                        >
                          <MoreHorizontal className="size-4" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {extras.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {extras.map((widget) =>
            widget.kind === "chart" ? (
              <section key={widget.id} className="col-span-2 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
                <h2 className="mb-2 text-sm font-semibold text-slate-800">{widget.label}</h2>
                {widget.chart.length === 0 ? (
                  <p className="flex h-[220px] items-center justify-center text-sm text-slate-400">No data yet</p>
                ) : (
                  <SimpleBarChart data={widget.chart} />
                )}
              </section>
            ) : (
              <Link
                key={widget.id}
                href={widget.href}
                className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm hover:border-slate-300"
              >
                <p className="text-sm text-slate-500">{widget.label}</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{widget.value ?? 0}</p>
              </Link>
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}
