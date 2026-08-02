"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { shortDate } from "@/lib/dates";
import { formatPrice } from "@/lib/utils";

type Point = { date: string; amount: number };

/**
 * MASTER.md §5 ChartPanel line: `--primary-faint` area under a 2.5px
 * `--primary` line with round joins, `--border` grid, muted tabular axis
 * labels, r4 dots filled `--card`. Tooltip is the `--inverse-bg` pill.
 */
export function TrendChart({ data }: { data: Point[] }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <h2 className="mb-4 text-[18px] font-bold">Динамика трат</h2>

      <div className="h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -12 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="0" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={shortDate}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              className="tabular"
            />
            <YAxis
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              width={56}
              className="tabular"
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
              formatter={(value) => [formatPrice(Number(value)), "Потрачено"]}
            />
            <Area
              type="monotone"
              dataKey="amount"
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
    </div>
  );
}
