"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookMarked,
  ChefHat,
  ChevronLeft,
  ChevronRight,
  PencilLine,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { DayCard } from "./DayCard";
import { GenerateRecipeModal } from "./GenerateRecipeModal";
import { ManualRecipeModal } from "./ManualRecipeModal";
import { RecipePanel } from "./RecipePanel";
import { SchedulePicker } from "./SchedulePicker";
import { SavedRecipesModal } from "./SavedRecipesModal";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import {
  addDays,
  MEAL_LABELS,
  startOfWeek,
  todayIso,
  weekDays,
  weekRangeLabel,
  type MealTypeKey,
} from "@/lib/dates";
import { plural } from "@/lib/utils";
import type { MealEntryDTO } from "@/server/mealplan";
import type { RecipeDTO } from "@/server/recipes";


async function fetchMealPlan(from: string, to: string): Promise<MealEntryDTO[]> {
  const response = await fetch(`/api/meal-plan?from=${from}&to=${to}`);
  if (!response.ok) throw new Error("Не удалось загрузить календарь");
  return response.json();
}

export function MenuView() {
  const queryClient = useQueryClient();
  const toast = useToast();

  const today = todayIso();
  const [monday, setMonday] = useState(() => startOfWeek(today));
  const days = weekDays(monday);
  const planKey = ["meal-plan", monday];

  const [generateOpen, setGenerateOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);
  const [panelRecipe, setPanelRecipe] = useState<RecipeDTO | null>(null);
  const [panelContext, setPanelContext] = useState<string>();
  const [scheduling, setScheduling] = useState<{
    recipe: RecipeDTO;
    date?: string;
    meal?: MealTypeKey;
  } | null>(null);
  // Set when an empty day slot is clicked, so picking a recipe lands there.
  const [pendingSlot, setPendingSlot] = useState<{
    date: string;
    mealType: MealTypeKey;
  } | null>(null);

  // The kcal ring reads the user's real target from settings, not a constant.
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const r = await fetch("/api/settings");
      if (!r.ok) throw new Error("Не удалось загрузить настройки");
      return r.json() as Promise<{ kcalTarget: number }>;
    },
    staleTime: 5 * 60_000,
  });
  const kcalTarget = settings?.kcalTarget ?? 2000;

  const { data: entries = [], isLoading } = useQuery({
    queryKey: planKey,
    queryFn: () => fetchMealPlan(days[0], days[6]),
  });

  function refreshPlan() {
    queryClient.invalidateQueries({ queryKey: ["meal-plan"] });
  }

  const schedule = useMutation({
    mutationFn: async (vars: {
      recipeId: string;
      date: string;
      mealType: MealTypeKey;
    }) => {
      const response = await fetch("/api/meal-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vars),
      });
      if (!response.ok) throw new Error("Не удалось добавить в календарь");
      return response.json() as Promise<MealEntryDTO>;
    },
    onSuccess: (entry) => {
      refreshPlan();
      toast(`«${entry.recipe.title}» — ${MEAL_LABELS[entry.mealType]}`);
    },
    onError: () => toast("Не удалось добавить в календарь"),
  });

  const unschedule = useMutation({
    mutationFn: async (entry: MealEntryDTO) => {
      const response = await fetch(`/api/meal-plan/${entry.id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Не удалось убрать");
    },
    onSuccess: () => {
      refreshPlan();
      toast("Убрано из календаря");
    },
    onError: () => toast("Не удалось убрать"),
  });

  const toggleSaved = useMutation({
    mutationFn: async (recipe: RecipeDTO) => {
      const response = await fetch(`/api/recipes/${recipe.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isSaved: !recipe.isSaved }),
      });
      if (!response.ok) throw new Error("Не удалось сохранить");
      return response.json() as Promise<RecipeDTO>;
    },
    onSuccess: (recipe) => {
      setPanelRecipe(recipe);
      refreshPlan();
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
      toast(recipe.isSaved ? "Сохранён в «Мои рецепты»" : "Убран из «Мои рецепты»");
    },
    onError: () => toast("Не удалось сохранить"),
  });

  const removeRecipe = useMutation({
    mutationFn: async (recipe: RecipeDTO) => {
      const response = await fetch(`/api/recipes/${recipe.id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Не удалось удалить");
    },
    onSuccess: () => {
      setPanelRecipe(null);
      refreshPlan();
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
      toast("Рецепт удалён");
    },
    onError: () => toast("Не удалось удалить"),
  });

  const toShopping = useMutation({
    mutationFn: async (recipe: RecipeDTO) => {
      const response = await fetch(
        `/api/recipes/${recipe.id}/missing-to-shopping`,
        { method: "POST" },
      );
      if (!response.ok) throw new Error("Не удалось добавить в закупки");
      return response.json() as Promise<{ added: number; alreadyListed: number }>;
    },
    onSuccess: ({ added, alreadyListed }) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      if (added === 0) {
        toast("Всё уже в списке покупок");
      } else {
        toast(
          `${added} ${plural(added, "позиция", "позиции", "позиций")} в закупки` +
            (alreadyListed > 0 ? ` · ${alreadyListed} уже были` : ""),
        );
      }
    },
    onError: () => toast("Не удалось добавить в закупки"),
  });

  const busy =
    schedule.isPending ||
    toggleSaved.isPending ||
    removeRecipe.isPending ||
    toShopping.isPending;

  const weekKcal = entries.reduce((sum, e) => sum + (e.recipe.calories ?? 0), 0);
  const subtitle = isLoading
    ? "Загружаем…"
    : `${entries.length} ${plural(entries.length, "блюдо", "блюда", "блюд")} на неделе · ${weekKcal} ккал`;

  return (
    <>
      <ScreenHeader
        kicker="02 · Меню"
        title="Рацион"
        subtitle={subtitle}
        action={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMonday(addDays(monday, -7))}
              aria-label="Предыдущая неделя"
              title="Предыдущая неделя"
              className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl bg-muted text-muted-foreground transition-colors duration-[160ms] hover:bg-border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden />
            </button>
            <span className="min-w-[190px] text-center text-[15px] font-bold">
              {weekRangeLabel(monday)}
            </span>
            <button
              type="button"
              onClick={() => setMonday(addDays(monday, 7))}
              aria-label="Следующая неделя"
              title="Следующая неделя"
              className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl bg-muted text-muted-foreground transition-colors duration-[160ms] hover:bg-border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <ChevronRight className="h-5 w-5" aria-hidden />
            </button>
          </div>
        }
      />

      <div className="mb-6 flex flex-wrap gap-2">
        <Button onClick={() => setGenerateOpen(true)}>
          <Sparkles className="h-[18px] w-[18px]" aria-hidden />
          Шеф-повар Gemini
        </Button>
        <Button variant="tonal" onClick={() => setManualOpen(true)}>
          <PencilLine className="h-[18px] w-[18px]" aria-hidden />
          Свой рецепт
        </Button>
        <Button variant="tonal" onClick={() => setSavedOpen(true)}>
          <BookMarked className="h-[18px] w-[18px]" aria-hidden />
          Мои рецепты
        </Button>
      </div>

      {/* 4-column wrapping day grid: 7 cards flow 4+3 (MASTER.md §4). */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {days.map((iso) => (
          <DayCard
            key={iso}
            iso={iso}
            isToday={iso === today}
            entries={entries.filter((e) => e.date === iso)}
            kcalTarget={kcalTarget}
            selectedRecipeId={panelRecipe?.id}
            onOpenRecipe={(entry) => {
              setPanelRecipe(entry.recipe);
              setPanelContext(
                `${weekRangeLabel(monday).split(" — ")[0]} · ${MEAL_LABELS[entry.mealType]}`,
              );
            }}
            onAddTo={(date, mealType) => {
              setSavedOpen(true);
              setScheduling(null);
              // Remember the slot the user clicked so picking a recipe lands there.
              setPendingSlot({ date, mealType });
            }}
            onRemove={(entry) => unschedule.mutate(entry)}
          />
        ))}
      </div>

      {entries.length === 0 && !isLoading && (
        <div className="mt-6 flex flex-col items-center gap-3 rounded-2xl border border-border bg-card px-6 py-10 text-center shadow-soft">
          <div className="flex h-15 w-15 items-center justify-center rounded-full bg-muted p-4">
            <ChefHat className="h-6 w-6 text-muted-foreground" aria-hidden />
          </div>
          <p className="text-[15px] font-bold">Неделя пока пустая</p>
          <p className="max-w-72 text-[13px] font-medium text-muted-foreground">
            Попросите шеф-повара придумать блюдо из того, что есть дома.
          </p>
        </div>
      )}

      <GenerateRecipeModal
        open={generateOpen}
        onClose={() => setGenerateOpen(false)}
        onGenerated={(recipe) => {
          setPanelRecipe(recipe);
          setPanelContext("Новый рецепт");
        }}
      />

      <ManualRecipeModal
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        onCreated={(recipe) => {
          queryClient.invalidateQueries({ queryKey: ["recipes"] });
          setPanelRecipe(recipe);
          setPanelContext("Свой рецепт");
          toast(`«${recipe.title}» сохранён`);
        }}
      />

      <SavedRecipesModal
        open={savedOpen}
        onClose={() => {
          setSavedOpen(false);
          setPendingSlot(null);
        }}
        onPick={(recipe) => {
          setSavedOpen(false);
          if (pendingSlot) {
            schedule.mutate({
              recipeId: recipe.id,
              date: pendingSlot.date,
              mealType: pendingSlot.mealType,
            });
            setPendingSlot(null);
          } else {
            setPanelRecipe(recipe);
            setPanelContext("Мои рецепты");
          }
        }}
      />

      {scheduling && (
        <SchedulePicker
          open
          days={days}
          recipeTitle={scheduling.recipe.title}
          initialDate={scheduling.date}
          initialMeal={scheduling.meal}
          onClose={() => setScheduling(null)}
          onConfirm={(date, mealType) => {
            schedule.mutate({ recipeId: scheduling.recipe.id, date, mealType });
            setScheduling(null);
          }}
        />
      )}

      <RecipePanel
        recipe={panelRecipe}
        context={panelContext}
        busy={busy}
        onClose={() => setPanelRecipe(null)}
        onToggleSaved={() => panelRecipe && toggleSaved.mutate(panelRecipe)}
        onAddToCalendar={() =>
          panelRecipe && setScheduling({ recipe: panelRecipe })
        }
        onMissingToShopping={() => panelRecipe && toShopping.mutate(panelRecipe)}
        onDelete={() => panelRecipe && removeRecipe.mutate(panelRecipe)}
      />
    </>
  );
}
