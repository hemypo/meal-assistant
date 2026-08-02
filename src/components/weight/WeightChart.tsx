"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { shortDate } from "@/lib/dates";

type Point = { date: string; weightKg: number };

/**
 * MASTER.md §5 ChartPanel line, weight variant: same styling as the spend
 * trend plus a dashed `--accent` goal line labelled «цель N».
 */
export function WeightChart({
  data,
  goalKg,
}: {
  data: Point[];
  goalKg: number;
}) {
  const weights = data.map((d) => d.weightKg);
  // Keep the goal line inside the plotted band, else it renders off-chart.
  const min = Math.floor(Math.min(...weights, goalKg) - 1);
  const max = Math.ceil(Math.max(...weights, goalKg) + 1);

  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={shortDate}
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
          />
          <YAxis
            domain={[min, max]}
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={44}
          />
          <Tooltip
            cursor={{ stroke: "var(--border)" }}
            contentStyle={{
              background: "var(--inverse-bg)",
              color: "var(--inverse-fg)",
              border: "none",
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 600,
              padding: "6px 10px",
            }}
            labelStyle={{ color: "var(--inverse-fg)", opacity: 0.7 }}
            labelFormatter={(value) => shortDate(String(value))}
            formatter={(value) => [
              `${String(value).replace(".", ",")} кг`,
              "Вес",
            ]}
          />
          <ReferenceLine
            y={goalKg}
            stroke="var(--accent)"
            strokeDasharray="6 5"
            strokeWidth={2}
            label={{
              value: `цель ${String(goalKg).replace(".", ",")}`,
              position: "insideTopRight",
              fill: "var(--accent)",
              fontSize: 12,
              fontWeight: 700,
            }}
          />
          <Area
            type="monotone"
            dataKey="weightKg"
            stroke="var(--primary)"
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
            fill="var(--primary-faint)"
            isAnimationActive={false}
            dot={{ r: 4, fill: "var(--card)", stroke: "var(--primary)", strokeWidth: 2.5 }}
            activeDot={{ r: 6, fill: "var(--card)", stroke: "var(--primary)", strokeWidth: 2.5 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
