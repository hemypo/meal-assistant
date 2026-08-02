"use client";

import { Plus, X } from "lucide-react";
import {
  dayOfMonth,
  MEAL_LABELS,
  MEAL_TYPES,
  weekdayLabel,
  type MealTypeKey,
} from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { MealEntryDTO } from "@/server/mealplan";

/** MASTER.md §5 DayCard: header, 2x2 meal slots, kcal ring footer. */
export function DayCard({
  iso,
  isToday,
  entries,
  kcalTarget,
  selectedRecipeId,
  onOpenRecipe,
  onAddTo,
  onRemove,
}: {
  iso: string;
  isToday: boolean;
  entries: MealEntryDTO[];
  kcalTarget: number;
  selectedRecipeId?: string;
  onOpenRecipe: (entry: MealEntryDTO) => void;
  onAddTo: (iso: string, mealType: MealTypeKey) => void;
  onRemove: (entry: MealEntryDTO) => void;
}) {
  const kcal = entries.reduce((sum, e) => sum + (e.recipe.calories ?? 0), 0);
  const pct = kcalTarget > 0 ? Math.min(1, kcal / kcalTarget) : 0;

  // r15, stroke 3.5, -90° start (MASTER.md §5).
  const radius = 15;
  const circumference = 2 * Math.PI * radius;

  return (
    <article
      className={cn(
        "flex flex-col rounded-2xl border bg-card p-3 shadow-soft",
        isToday ? "border-2 border-primary" : "border-border",
      )}
    >
      <header className="mb-2.5 flex items-baseline gap-2">
        <span className="text-xs font-bold uppercase text-muted-foreground">
          {weekdayLabel(iso)}
        </span>
        <span
          className={cn(
            "tabular text-[18px] font-extrabold",
            isToday && "text-primary",
          )}
        >
          {dayOfMonth(iso)}
        </span>
        {isToday && (
          <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-bold text-primary">
            сегодня
          </span>
        )}
      </header>

      <div className="grid grid-cols-2 gap-1.5">
        {MEAL_TYPES.map((mealType) => {
          const slot = entries.filter((e) => e.mealType === mealType);

          if (slot.length === 0) {
            return (
              <button
                key={mealType}
                type="button"
                onClick={() => onAddTo(iso, mealType)}
                title={`Добавить: ${MEAL_LABELS[mealType]}`}
                className="flex min-h-16 cursor-pointer flex-col items-center justify-center gap-1 rounded-[10px] border-[1.5px] border-dashed border-border text-muted-foreground transition-colors duration-[160ms] hover:border-secondary hover:text-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <Plus className="h-4 w-4" aria-hidden />
                <span className="text-[11px] font-semibold">
                  {MEAL_LABELS[mealType]}
                </span>
              </button>
            );
          }

          return (
            <div key={mealType} className="flex flex-col gap-1.5">
              {slot.map((entry) => (
                <div
                  key={entry.id}
                  className={cn(
                    "group relative rounded-[10px] bg-muted p-2",
                    selectedRecipeId === entry.recipe.id &&
                      "ring-2 ring-primary",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onOpenRecipe(entry)}
                    className="w-full cursor-pointer text-left"
                    title={entry.recipe.title}
                  >
                    <span className="block text-[11px] font-semibold text-muted-foreground">
                      {MEAL_LABELS[mealType]}
                    </span>
                    <span className="line-clamp-2 block text-[13px] font-semibold">
                      {entry.recipe.title}
                    </span>
                    {entry.recipe.calories !== null && (
                      <span className="tabular block text-[11px] text-muted-foreground">
                        {entry.recipe.calories} ккал
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemove(entry)}
                    aria-label={`Убрать «${entry.recipe.title}» из календаря`}
                    title="Убрать из календаря"
                    className="absolute right-1 top-1 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full text-muted-foreground opacity-0 transition-opacity duration-[160ms] hover:bg-destructive-soft hover:text-destructive focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring group-hover:opacity-100"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      <footer className="mt-2.5 flex items-center gap-2 border-t border-border pt-2.5">
        <svg width="36" height="36" viewBox="0 0 36 36" aria-hidden>
          <circle
            cx="18"
            cy="18"
            r={radius}
            fill="none"
            stroke="var(--border)"
            strokeWidth="3.5"
          />
          <circle
            cx="18"
            cy="18"
            r={radius}
            fill="none"
            stroke="var(--kcal)"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - pct)}
            transform="rotate(-90 18 18)"
          />
        </svg>
        <span className="tabular text-[13px] font-semibold text-muted-foreground">
          {kcal} / {kcalTarget}
        </span>
      </footer>
    </article>
  );
}
