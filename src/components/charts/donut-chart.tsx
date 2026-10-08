"use client";

import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { TAGX_GREEN, TAGX_TEAL } from "@/lib/brand";

const COLORS = [TAGX_TEAL, TAGX_GREEN, "#3B82F6", "#F59E0B", "#8B5CF6", "#94A3B8"];

export function DonutChart({
  data,
  centerValue,
  centerLabel,
}: {
  data: { name: string; value: number }[];
  centerValue: string;
  centerLabel: string;
}) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const slices = data.filter((item) => item.value > 0);
  const chartData = slices.length > 0 ? slices : [{ name: "Empty", value: 1 }];

  return (
    <div className="flex items-center gap-3">
      <div className="relative h-40 w-40 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              innerRadius={52}
              outerRadius={70}
              stroke="none"
              paddingAngle={slices.length > 1 ? 2 : 0}
              startAngle={90}
              endAngle={-270}
            >
              {chartData.map((entry) => (
                <Cell
                  key={entry.name}
                  fill={slices.length > 0 ? COLORS[data.findIndex((item) => item.name === entry.name) % COLORS.length] : "#E6EDF2"}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold leading-none text-slate-900">{centerValue}</span>
          <span className="mt-1 max-w-[4.5rem] text-center text-[11px] leading-tight text-slate-500">{centerLabel}</span>
        </div>
      </div>
      <ul className="flex min-w-0 flex-1 flex-col gap-2 text-sm">
        {data.map((item, index) => {
          const percent = total > 0 ? Math.round((item.value / total) * 100) : 0;
          return (
            <li key={item.name} className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2">
                <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                <span className="truncate text-slate-700">{item.name}</span>
              </span>
              <span className="shrink-0 tabular-nums text-slate-500">
                {item.value} <span className="text-slate-400">{percent}%</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
