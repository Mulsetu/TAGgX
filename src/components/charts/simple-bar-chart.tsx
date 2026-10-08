"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { TAGX_TEAL } from "@/lib/brand";

export interface BarChartDatum {
  name: string;
  value: number;
}

export function SimpleBarChart({ data, color = TAGX_TEAL }: { data: BarChartDatum[]; color?: string }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="#E6EDF2" />
        <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#64748B" }} axisLine={false} tickLine={false} />
        <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#94A3B8" }} axisLine={false} tickLine={false} width={32} />
        <Tooltip cursor={{ fill: "rgba(15, 110, 122, 0.06)" }} />
        <Bar dataKey="value" fill={color} radius={[6, 6, 0, 0]} maxBarSize={48} />
      </BarChart>
    </ResponsiveContainer>
  );
}
