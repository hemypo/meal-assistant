"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import {
  longDate,
  MEAL_LABELS,
  MEAL_TYPES,
  weekdayLabel,
  type MealTypeKey,
} from "@/lib/dates";
import { cn } from "@/lib/utils";

/** Pick a date + meal slot for a recipe. Used by «В календарь». */
export function SchedulePicker({
  open,
  days,
  recipeTitle,
  initialDate,
  initialMeal,
  onClose,
  onConfirm,
}: {
  open: boolean;
  days: string[];
  recipeTitle: string;
  initialDate?: string;
  initialMeal?: MealTypeKey;
  onClose: () => void;
  onConfirm: (iso: string, mealType: MealTypeKey) => void;
}) {
  const [date, setDate] = useState(initialDate ?? days[0]);
  const [meal, setMeal] = useState<MealTypeKey>(initialMeal ?? "DINNER");

  return (
    <Modal open={open} onClose={onClose} title="В календарь">
      <div className="flex-1 overflow-y-auto p-5">
        <p className="mb-4 text-sm font-medium text-muted-foreground">
          «{recipeTitle}»
        </p>

        <h3 className="mb-2 text-[13px] font-semibold text-muted-foreground">
          День
        </h3>
        <div className="mb-5 grid grid-cols-4 gap-1.5 sm:grid-cols-7">
          {days.map((iso) => (
            <button
              key={iso}
              type="button"
              onClick={() => setDate(iso)}
              className={cn(
                "cursor-pointer rounded-[10px] px-2 py-2 text-center transition-colors duration-[160ms]",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                date === iso
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-border",
              )}
              title={longDate(iso)}
            >
              <span className="block text-[11px] font-bold uppercase">
                {weekdayLabel(iso)}
              </span>
              <span className="tabular block text-[15px] font-bold">
                {Number(iso.slice(8, 10))}
              </span>
            </button>
          ))}
        </div>

        <h3 className="mb-2 text-[13px] font-semibold text-muted-foreground">
          Приём пищи
        </h3>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {MEAL_TYPES.map((mealType) => (
            <button
              key={mealType}
              type="button"
              onClick={() => setMeal(mealType)}
              className={cn(
                "cursor-pointer rounded-full px-3 py-2 text-[13px] font-bold transition-colors duration-[160ms]",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                meal === mealType
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-border",
              )}
            >
              {MEAL_LABELS[mealType]}
            </button>
          ))}
        </div>
      </div>

      <footer className="flex justify-end gap-2 border-t border-border px-5 py-4">
        <Button variant="tonal" onClick={onClose} type="button">
          Отмена
        </Button>
        <Button onClick={() => onConfirm(date, meal)} type="button">
          Добавить
        </Button>
      </footer>
    </Modal>
  );
}
