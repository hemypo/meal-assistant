"use client";

import { Bookmark, BookmarkCheck, CalendarPlus, Clock, ShoppingCart, Trash2, X } from "lucide-react";
import { useEffect } from "react";
import { KbjuBadges } from "@/components/ui/KbjuBadges";
import { Button } from "@/components/ui/Button";
import { cn, formatPrice, formatQuantity, plural } from "@/lib/utils";
import type { RecipeDTO } from "@/server/recipes";

/**
 * MASTER.md §5 RecipePanel: fixed right slide-over, 440px desktop / full-width
 * mobile, Esc + 44px close button, scrollable.
 */
export function RecipePanel({
  recipe,
  context,
  busy,
  onClose,
  onToggleSaved,
  onAddToCalendar,
  onMissingToShopping,
  onDelete,
}: {
  recipe: RecipeDTO | null;
  context?: string;
  busy?: boolean;
  onClose: () => void;
  onToggleSaved: () => void;
  onAddToCalendar: () => void;
  onMissingToShopping: () => void;
  onDelete: () => void;
}) {
  // Global Esc listener (MASTER.md §4 keyboard rules).
  useEffect(() => {
    if (!recipe) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [recipe, onClose]);

  if (!recipe) return null;

  const missing = recipe.ingredients.filter((i) => !i.wasInStock);

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/40"
        onClick={onClose}
        aria-hidden
      />
      <aside
        role="dialog"
        aria-label={recipe.title}
        className="animate-screen-enter fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-border bg-card shadow-[-16px_0_48px_rgba(0,0,0,0.45)] lg:w-[440px]"
      >
        <header className="flex items-start justify-between gap-3 border-b border-border p-5">
          <div className="min-w-0">
            {context && (
              <p className="mb-1 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
                {context}
              </p>
            )}
            <h2 className="text-[22px] font-extrabold leading-tight">
              {recipe.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            title="Закрыть (Esc)"
            className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl text-muted-foreground transition-colors duration-[160ms] hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {recipe.cookTimeMin !== null && (
              <span className="tabular inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[13px] font-bold text-muted-foreground">
                <Clock className="h-3.5 w-3.5" aria-hidden />
                {recipe.cookTimeMin} мин
              </span>
            )}
            <KbjuBadges values={recipe} />
          </div>

          <h3 className="mb-2 text-[13px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Ингредиенты
          </h3>
          <ul className="mb-5 flex flex-col gap-1.5">
            {recipe.ingredients.map((ingredient) => (
              <li key={ingredient.id} className="flex items-baseline gap-2">
                <span
                  aria-hidden
                  className={cn(
                    "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                    ingredient.wasInStock ? "bg-accent" : "bg-secondary",
                  )}
                />
                <span className="flex-1 text-[15px] font-medium">
                  {ingredient.name}
                  {!ingredient.wasInStock && (
                    <span className="ml-1.5 text-[13px] font-semibold text-secondary">
                      нет в наличии
                      {ingredient.estPrice !== null &&
                        ` · ~${formatPrice(ingredient.estPrice)}`}
                    </span>
                  )}
                </span>
                <span className="tabular shrink-0 text-[13px] font-semibold text-muted-foreground">
                  {formatQuantity(ingredient.amount)} {ingredient.unit}
                </span>
              </li>
            ))}
          </ul>

          <h3 className="mb-2 text-[13px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Приготовление
          </h3>
          <ol className="flex flex-col gap-2.5">
            {recipe.steps.map((step, index) => (
              <li key={index} className="flex gap-2.5">
                <span className="tabular flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[13px] font-bold text-muted-foreground">
                  {index + 1}
                </span>
                <span className="pt-0.5 text-[15px] font-medium">{step}</span>
              </li>
            ))}
          </ol>
        </div>

        <footer className="flex flex-col gap-2 border-t border-border p-5">
          {/* MASTER.md §5: accent fill when N>0, disabled-tonal when N=0. */}
          <button
            type="button"
            onClick={onMissingToShopping}
            disabled={missing.length === 0 || busy}
            title={
              missing.length === 0
                ? "Все ингредиенты есть или в списке"
                : "Добавить недостающее в список покупок"
            }
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-[15px] font-bold",
              "transition-all duration-[160ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              missing.length > 0
                ? "cursor-pointer bg-accent-strong text-primary-foreground hover:brightness-110 active:scale-[0.97]"
                : "cursor-default bg-muted text-muted-foreground",
            )}
          >
            <ShoppingCart className="h-[18px] w-[18px]" aria-hidden />
            {missing.length > 0
              ? `Недостающее — в закупки (${missing.length})`
              : "Все ингредиенты есть или в списке"}
          </button>

          <div className="flex gap-2">
            <Button
              variant="tonal"
              onClick={onToggleSaved}
              disabled={busy}
              className="flex-1"
              title={
                recipe.isSaved
                  ? "Убрать из «Мои рецепты»"
                  : "Сохранить в «Мои рецепты»"
              }
            >
              {recipe.isSaved ? (
                <BookmarkCheck className="h-[18px] w-[18px]" aria-hidden />
              ) : (
                <Bookmark className="h-[18px] w-[18px]" aria-hidden />
              )}
              {recipe.isSaved ? "Сохранён" : "Сохранить"}
            </Button>
            <Button
              variant="tonal"
              onClick={onAddToCalendar}
              disabled={busy}
              className="flex-1"
              title="Добавить в календарь"
            >
              <CalendarPlus className="h-[18px] w-[18px]" aria-hidden />
              В календарь
            </Button>
            <button
              type="button"
              onClick={onDelete}
              disabled={busy}
              aria-label={`Удалить рецепт «${recipe.title}»`}
              title="Удалить рецепт"
              className="flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-2xl text-muted-foreground transition-colors duration-[160ms] hover:bg-destructive-soft hover:text-destructive focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50"
            >
              <Trash2 className="h-[18px] w-[18px]" aria-hidden />
            </button>
          </div>

          {missing.length > 0 && (
            <p className="tabular text-center text-[13px] font-medium text-muted-foreground">
              {missing.length}{" "}
              {plural(missing.length, "ингредиент", "ингредиента", "ингредиентов")}{" "}
              не хватает
            </p>
          )}
        </footer>
      </aside>
    </>
  );
}
