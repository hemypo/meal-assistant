"use client";

import { useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { formatPrice } from "@/lib/utils";

/** MASTER.md §3.1 chart palette, in this order. */
const PALETTE = [
  "var(--primary)",
  "var(--accent)",
  "var(--sage)",
  "var(--secondary)",
  "var(--protein)",
];

type Slice = { category: string; amount: number; share: number };

/**
 * MASTER.md §5 ChartPanel donut: ring centred at r62 with stroke 30 (so
 * inner 47 / outer 77), 2.5px gaps, −90° start, hovered segment grows to 37.
 * Centre shows the total, or the hovered slice. Legend is mandatory and
 * duplicates every value as text — colour never carries meaning alone.
 */
export function CategoryDonut({
  data,
  total,
}: {
  data: Slice[];
  total: number;
}) {
  const [hovered, setHovered] = useState<number>();

  const active = hovered === undefined ? null : data[hovered];

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <h2 className="mb-4 text-[18px] font-bold">Куда уходят деньги</h2>

      <div className="relative mx-auto h-[190px] w-full max-w-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="amount"
              nameKey="category"
              innerRadius={47}
              outerRadius={77}
              paddingAngle={2.5}
              startAngle={90}
              endAngle={-270}
              stroke="none"
              isAnimationActive={false}
              // MASTER.md asks the hovered segment to grow 30 → 37. Recharts 3
              // dropped both `Cell.outerRadius` and `Pie.activeIndex`, so hover
              // is expressed by dimming the other slices instead — the fallback
              // MASTER.md §5 explicitly allows "where Recharts can't".
              onMouseEnter={(_, index) => setHovered(index)}
              onMouseLeave={() => setHovered(undefined)}
            >
              {data.map((slice, index) => (
                <Cell
                  key={slice.category}
                  fill={PALETTE[index % PALETTE.length]}
                  className="cursor-pointer"
                  opacity={hovered === undefined || hovered === index ? 1 : 0.55}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="tabular text-[20px] font-extrabold tracking-[-0.02em]">
            {formatPrice(active ? active.amount : total)}
          </p>
          <p className="max-w-[110px] truncate text-[11px] font-semibold text-muted-foreground">
            {active ? active.category : "всего"}
          </p>
        </div>
      </div>

      <ul className="mt-4 flex flex-col gap-2">
        {data.map((slice, index) => (
          <li
            key={slice.category}
            onMouseEnter={() => setHovered(index)}
            onMouseLeave={() => setHovered(undefined)}
            className="flex items-center gap-2.5 text-[13px]"
          >
            <span
              aria-hidden
              className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
              style={{ background: PALETTE[index % PALETTE.length] }}
            />
            <span className="flex-1 truncate font-medium">{slice.category}</span>
            <span className="tabular font-bold">{formatPrice(slice.amount)}</span>
            <span className="tabular w-12 text-right font-medium text-muted-foreground">
              {slice.share}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
