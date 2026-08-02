import { cn } from "@/lib/utils";

/**
 * MASTER.md §5 StatCard: label 13/600 muted → value 32/800 tabular −0.02em →
 * optional delta line 13/600, coloured only when the delta means something.
 */
export function StatCard({
  label,
  value,
  delta,
  deltaTone = "muted",
}: {
  label: string;
  value: string;
  delta?: string;
  deltaTone?: "muted" | "up" | "down";
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <p className="text-[13px] font-semibold text-muted-foreground">{label}</p>
      <p className="tabular mt-1 text-[32px] font-extrabold leading-tight tracking-[-0.02em]">
        {value}
      </p>
      {delta && (
        <p
          className={cn(
            "tabular mt-1 text-[13px] font-semibold",
            deltaTone === "up" && "text-secondary",
            deltaTone === "down" && "text-accent-strong",
            deltaTone === "muted" && "text-muted-foreground",
          )}
        >
          {delta}
        </p>
      )}
    </div>
  );
}
