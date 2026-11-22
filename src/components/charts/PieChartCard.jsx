"use client";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
import Card from "@/components/ui/Card";

const COLORS = ["#14a38b", "#0ea5e9", "#f59e0b", "#ef4444", "#8b5cf6", "#64748b"];

export default function PieChartCard({ title, data, nameKey = "label", valueKey = "value" }) {
  return (
    <Card title={title}>
      <div className="h-64">
        {!data || data.length === 0 ? (
          <p className="flex h-full items-center justify-center text-sm text-slate-500">No data yet.</p>
        ) : (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey={valueKey} nameKey={nameKey} innerRadius={55} outerRadius={85} paddingAngle={2} stroke="none">
              {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}
