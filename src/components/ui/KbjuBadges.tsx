import { cn } from "@/lib/utils";

/**
 * MASTER.md §5 KbjuBadges — four pills, 13/700 tabular, each *-soft background
 * with its *-strong text, and a `title` carrying the full name.
 */
const MACROS = [
  { key: "calories", short: "К", full: "Калории, ккал", cls: "bg-[var(--kcal-soft)] text-[var(--kcal)]" },
  { key: "proteinG", short: "Б", full: "Белки, г", cls: "bg-[var(--protein-soft)] text-[var(--protein-strong)]" },
  { key: "fatG", short: "Ж", full: "Жиры, г", cls: "bg-[var(--fat-soft)] text-[var(--fat-strong)]" },
  { key: "carbsG", short: "У", full: "Углеводы, г", cls: "bg-[var(--carbs-soft)] text-[var(--carbs-strong)]" },
] as const;

export function KbjuBadges({
  values,
  className,
}: {
  values: {
    calories: number | null;
    proteinG: number | null;
    fatG: number | null;
    carbsG: number | null;
  };
  className?: string;
}) {
  const present = MACROS.filter((m) => values[m.key] !== null);
  if (present.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {present.map((macro) => (
        <span
          key={macro.key}
          title={macro.full}
          className={cn(
            "tabular rounded-full px-2.5 py-1 text-[13px] font-bold",
            macro.cls,
          )}
        >
          {macro.short} {values[macro.key]}
        </span>
      ))}
    </div>
  );
}
