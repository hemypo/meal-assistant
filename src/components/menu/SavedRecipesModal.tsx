"use client";

import { useQuery } from "@tanstack/react-query";
import { BookMarked, Clock } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { KbjuBadges } from "@/components/ui/KbjuBadges";
import { plural } from "@/lib/utils";
import type { RecipeDTO } from "@/server/recipes";

async function fetchSaved(): Promise<RecipeDTO[]> {
  const response = await fetch("/api/recipes?saved=true");
  if (!response.ok) throw new Error("Не удалось загрузить рецепты");
  return response.json();
}

/** «Мои рецепты» — reused with zero AI calls (master plan §11). */
export function SavedRecipesModal({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (recipe: RecipeDTO) => void;
}) {
  const { data: recipes = [], isLoading } = useQuery({
    queryKey: ["recipes", "saved"],
    queryFn: fetchSaved,
    enabled: open,
  });

  return (
    <Modal open={open} onClose={onClose} title="Мои рецепты">
      <div className="flex-1 overflow-y-auto p-5">
        {isLoading && (
          <p className="py-8 text-center text-[13px] font-medium text-muted-foreground">
            Загружаем…
          </p>
        )}

        {!isLoading && recipes.length === 0 && (
          <EmptyState
            icon={BookMarked}
            title="Пока нет сохранённых"
            description="Сохраните рецепт из панели — он появится здесь и не потребует нового запроса к ИИ."
          />
        )}

        {recipes.length > 0 && (
          <ul className="flex flex-col gap-2">
            {recipes.map((recipe) => (
              <li key={recipe.id}>
                <button
                  type="button"
                  onClick={() => onPick(recipe)}
                  className="w-full cursor-pointer rounded-2xl border border-border p-3.5 text-left transition-colors duration-[160ms] hover:border-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <p className="text-[15px] font-bold">{recipe.title}</p>
                  <p className="tabular mt-0.5 flex items-center gap-2 text-[13px] font-medium text-muted-foreground">
                    {recipe.cookTimeMin !== null && (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" aria-hidden />
                        {recipe.cookTimeMin} мин
                      </span>
                    )}
                    <span>
                      {recipe.ingredients.length}{" "}
                      {plural(
                        recipe.ingredients.length,
                        "ингредиент",
                        "ингредиента",
                        "ингредиентов",
                      )}
                    </span>
                  </p>
                  <KbjuBadges values={recipe} className="mt-2" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
