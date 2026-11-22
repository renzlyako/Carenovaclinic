"use client";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import Card from "@/components/ui/Card";

// horizontal = bars go left to right (good for long labels such as diagnoses)
// prefix = shown before values in the tooltip, for example "₱"
export default function BarChartCard({ title, data, xKey = "label", yKey = "value", horizontal = false, prefix = "" }) {
  const empty = !data || data.length === 0 || data.every((d) => !d[yKey]);
  return (
    <Card title={title}>
      <div className="h-64">
        {empty ? (
          <p className="flex h-full items-center justify-center text-sm text-slate-500">No data yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout={horizontal ? "vertical" : "horizontal"} margin={horizontal ? { left: 20 } : undefined}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={!horizontal} vertical={horizontal} />
              {horizontal ? (
                <>
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey={xKey} width={120} tick={{ fontSize: 12, fill: "#475569" }} tickLine={false} axisLine={false} />
                </>
              ) : (
                <>
                  <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={prefix !== ""} tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} />
                </>
              )}
              <Tooltip cursor={{ fill: "#f1f5f9" }} contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} formatter={(v) => `${prefix}${Number(v).toLocaleString("en-PH")}`} />
              <Bar dataKey={yKey} fill="#14a38b" radius={horizontal ? [0, 6, 6, 0] : [6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}
