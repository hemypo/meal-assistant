"use client";

import { Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { askAi } from "@/lib/ai-client";
import { cn, UNITS } from "@/lib/utils";
import type { RecipeDTO } from "@/server/recipes";

type Ingredient = { name: string; amount: string; unit: string };

const EMPTY_INGREDIENT: Ingredient = { name: "", amount: "100", unit: "г" };

const KBJU_FIELDS = [
  { key: "calories", label: "Ккал" },
  { key: "proteinG", label: "Белки" },
  { key: "fatG", label: "Жиры" },
  { key: "carbsG", label: "Углеводы" },
] as const;

type KbjuKey = (typeof KBJU_FIELDS)[number]["key"];

/** «Свой рецепт» — manual entry with an AI assist on КБЖУ (master plan §6.4). */
export function ManualRecipeModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (recipe: RecipeDTO) => void;
}) {
  const [title, setTitle] = useState("");
  const [cookTime, setCookTime] = useState("");
  const [ingredients, setIngredients] = useState<Ingredient[]>([
    { ...EMPTY_INGREDIENT },
  ]);
  const [steps, setSteps] = useState<string[]>([""]);
  const [kbju, setKbju] = useState<Record<KbjuKey, string>>({
    calories: "",
    proteinG: "",
    fatG: "",
    carbsG: "",
  });
  const [estimating, setEstimating] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  function reset() {
    setTitle("");
    setCookTime("");
    setIngredients([{ ...EMPTY_INGREDIENT }]);
    setSteps([""]);
    setKbju({ calories: "", proteinG: "", fatG: "", carbsG: "" });
    setError(undefined);
    setPending(false);
    setEstimating(false);
  }

  function close() {
    reset();
    onClose();
  }

  const filledIngredients = ingredients.filter((i) => i.name.trim());

  async function estimateKbju() {
    if (filledIngredients.length === 0) return;
    setEstimating(true);
    setError(undefined);
    try {
      const result = await askAi<Record<KbjuKey, number>>("estimate_kbju", {
        title: title.trim() || undefined,
        ingredients: filledIngredients.map(
          (i) => `${i.name.trim()} ${i.amount} ${i.unit}`,
        ),
      });
      setKbju({
        calories: String(result.calories),
        proteinG: String(result.proteinG),
        fatG: String(result.fatG),
        carbsG: String(result.carbsG),
      });
    } catch {
      setError("Не удалось оценить КБЖУ");
    } finally {
      setEstimating(false);
    }
  }

  async function save() {
    const cleanSteps = steps.map((s) => s.trim()).filter(Boolean);
    if (!title.trim()) return setError("Укажите название");
    if (cleanSteps.length === 0) return setError("Добавьте хотя бы один шаг");

    setPending(true);
    setError(undefined);
    try {
      const toInt = (v: string) =>
        v.trim() === "" ? null : Math.round(Number(v.replace(",", ".")));

      const response = await fetch("/api/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          steps: cleanSteps,
          cookTimeMin: toInt(cookTime),
          calories: toInt(kbju.calories),
          proteinG: toInt(kbju.proteinG),
          fatG: toInt(kbju.fatG),
          carbsG: toInt(kbju.carbsG),
          source: "MANUAL",
          isSaved: true, // a hand-written recipe is worth keeping by definition
          ingredients: filledIngredients.map((i) => ({
            name: i.name.trim(),
            amount: Number(i.amount.replace(",", ".")) || 1,
            unit: i.unit,
            wasInStock: true,
            estPrice: null,
          })),
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Не удалось сохранить");
      onCreated(body as RecipeDTO);
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить");
      setPending(false);
    }
  }

  const fieldCls =
    "rounded-[10px] bg-muted px-3 py-2 text-[15px] font-medium text-foreground placeholder:text-muted-foreground focus:bg-card focus:outline-2 focus:outline-offset-2 focus:outline-ring";

  return (
    <Modal open={open} onClose={close} title="Свой рецепт">
      <div className="flex-1 overflow-y-auto p-5">
        <label htmlFor="r-title" className="mb-1.5 block text-[13px] font-semibold text-muted-foreground">
          Название
        </label>
        <input
          id="r-title"
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Омлет с помидорами"
          className={cn(fieldCls, "mb-4 w-full")}
        />

        <label htmlFor="r-time" className="mb-1.5 block text-[13px] font-semibold text-muted-foreground">
          Время, мин
        </label>
        <input
          id="r-time"
          inputMode="decimal"
          value={cookTime}
          onChange={(e) => setCookTime(e.target.value)}
          placeholder="20"
          className={cn(fieldCls, "tabular mb-5 w-28")}
        />

        <h3 className="mb-2 text-[13px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
          Ингредиенты
        </h3>
        <ul className="mb-3 flex flex-col gap-2">
          {ingredients.map((ingredient, index) => (
            <li key={index} className="grid grid-cols-[1fr_5rem_5rem_auto] gap-2">
              <input
                aria-label="Название ингредиента"
                value={ingredient.name}
                onChange={(e) =>
                  setIngredients((c) =>
                    c.map((x, i) => (i === index ? { ...x, name: e.target.value } : x)),
                  )
                }
                placeholder="Яйцо"
                className={fieldCls}
              />
              <input
                aria-label="Количество"
                inputMode="decimal"
                value={ingredient.amount}
                onChange={(e) =>
                  setIngredients((c) =>
                    c.map((x, i) => (i === index ? { ...x, amount: e.target.value } : x)),
                  )
                }
                className={cn(fieldCls, "tabular")}
              />
              <select
                aria-label="Единица"
                value={ingredient.unit}
                onChange={(e) =>
                  setIngredients((c) =>
                    c.map((x, i) => (i === index ? { ...x, unit: e.target.value } : x)),
                  )
                }
                className={cn(fieldCls, "cursor-pointer")}
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setIngredients((c) => c.filter((_, i) => i !== index))}
                disabled={ingredients.length === 1}
                aria-label="Убрать ингредиент"
                title="Убрать ингредиент"
                className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl text-muted-foreground transition-colors duration-[160ms] hover:bg-destructive-soft hover:text-destructive disabled:cursor-default disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
        <Button
          type="button"
          variant="tonal"
          onClick={() => setIngredients((c) => [...c, { ...EMPTY_INGREDIENT }])}
          className="mb-5 px-3.5 py-2 text-[13px]"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Ингредиент
        </Button>

        <h3 className="mb-2 text-[13px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
          Шаги
        </h3>
        <ol className="mb-3 flex flex-col gap-2">
          {steps.map((step, index) => (
            <li key={index} className="flex items-start gap-2">
              <span className="tabular mt-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[13px] font-bold text-muted-foreground">
                {index + 1}
              </span>
              <input
                aria-label={`Шаг ${index + 1}`}
                value={step}
                onChange={(e) =>
                  setSteps((c) => c.map((x, i) => (i === index ? e.target.value : x)))
                }
                placeholder="Взбить яйца"
                className={cn(fieldCls, "flex-1")}
              />
              <button
                type="button"
                onClick={() => setSteps((c) => c.filter((_, i) => i !== index))}
                disabled={steps.length === 1}
                aria-label={`Убрать шаг ${index + 1}`}
                title="Убрать шаг"
                className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl text-muted-foreground transition-colors duration-[160ms] hover:bg-destructive-soft hover:text-destructive disabled:cursor-default disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            </li>
          ))}
        </ol>
        <Button
          type="button"
          variant="tonal"
          onClick={() => setSteps((c) => [...c, ""])}
          className="mb-5 px-3.5 py-2 text-[13px]"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Шаг
        </Button>

        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-[13px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            КБЖУ
          </h3>
          <button
            type="button"
            onClick={estimateKbju}
            disabled={estimating || filledIngredients.length === 0}
            title="Оценить КБЖУ по ингредиентам"
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1.5 text-[13px] font-bold text-primary transition-all duration-[160ms] hover:brightness-110 disabled:cursor-default disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {estimating ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                Gemini думает…
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                Оценить с ИИ
              </>
            )}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {KBJU_FIELDS.map((field) => (
            <div key={field.key} className="flex flex-col gap-1">
              <label
                htmlFor={`kbju-${field.key}`}
                className="text-[11px] font-semibold text-muted-foreground"
              >
                {field.label}
              </label>
              <input
                id={`kbju-${field.key}`}
                inputMode="decimal"
                value={kbju[field.key]}
                onChange={(e) =>
                  setKbju((c) => ({ ...c, [field.key]: e.target.value }))
                }
                placeholder="—"
                className={cn(fieldCls, "tabular")}
              />
            </div>
          ))}
        </div>

        {error && (
          <p className="mt-3 text-[13px] font-semibold text-destructive">{error}</p>
        )}
      </div>

      <footer className="flex justify-end gap-2 border-t border-border px-5 py-4">
        <Button variant="tonal" onClick={close} type="button" disabled={pending}>
          Отмена
        </Button>
        <Button onClick={save} type="button" disabled={pending}>
          {pending ? "Сохраняем…" : "Сохранить рецепт"}
        </Button>
      </footer>
    </Modal>
  );
}
