"use client";

import { ListPlus, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { AiSuggestionChip, AiTriggerButton } from "@/components/ai/AiSuggestion";
import { Button } from "@/components/ui/Button";
import { Field, Select } from "@/components/ui/Field";
import { askAi } from "@/lib/ai-client";
import { CATEGORIES, UNITS } from "@/lib/utils";
import type { CreateProductInput } from "@/lib/validation/product";
import type { ProductStatus } from "@/generated/prisma/enums";

const EMPTY = {
  name: "",
  category: "Другое",
  quantity: "1",
  unit: "шт",
  estPrice: "",
};

/**
 * Single-row add form (MASTER.md §5). AI assistance is opt-in per field:
 * category fills passively after a 500ms pause but only as a dismissible
 * suggestion; unit and price are explicit ✨ actions.
 */
export function AddProductForm({
  status,
  onCreate,
  onOpenBulk,
  pending,
}: {
  status: ProductStatus;
  onCreate: (input: CreateProductInput) => void;
  onOpenBulk: () => void;
  pending: boolean;
}) {
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string>();

  const [categoryHint, setCategoryHint] = useState<string>();
  const [unitPending, setUnitPending] = useState(false);
  const [unitHint, setUnitHint] = useState<string>();
  const [pricePending, setPricePending] = useState(false);
  const [priceHint, setPriceHint] = useState<number>();

  function set(key: keyof typeof EMPTY, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  // Passive category suggestion — cheap task, 500ms debounce (MASTER.md §5).
  // The cleanup cancels in-flight results, so a response for an older name can
  // never land on the current one.
  useEffect(() => {
    const name = form.name.trim();
    if (name.length < 3) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const result = await askAi<{ name: string; category: string }[]>(
          "categorize",
          { names: [name] },
        );
        if (!cancelled) setCategoryHint(result[0]?.category);
      } catch {
        // Silent: a passive hint failing must never interrupt typing.
      }
    }, 500);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [form.name]);

  async function suggestUnit() {
    const name = form.name.trim();
    if (!name) return;
    setUnitPending(true);
    try {
      const { unit } = await askAi<{ unit: string }>("suggest_unit", { name });
      if (unit !== form.unit) setUnitHint(unit);
    } catch {
      setError("Не удалось получить подсказку");
    } finally {
      setUnitPending(false);
    }
  }

  async function estimatePrice() {
    const name = form.name.trim();
    const quantity = Number(form.quantity.replace(",", "."));
    if (!name || !Number.isFinite(quantity) || quantity <= 0) return;
    setPricePending(true);
    try {
      const { price } = await askAi<{ price: number }>("estimate_price", {
        name,
        quantity,
        unit: form.unit,
      });
      setPriceHint(Math.round(price));
    } catch {
      setError("Не удалось оценить цену");
    } finally {
      setPricePending(false);
    }
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = form.name.trim();
    if (!name) {
      setError("Укажите название");
      return;
    }
    const quantity = Number(form.quantity.replace(",", "."));
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError("Количество должно быть больше 0");
      return;
    }
    const price =
      form.estPrice.trim() === ""
        ? null
        : Number(form.estPrice.replace(",", "."));
    if (price !== null && (!Number.isFinite(price) || price < 0)) {
      setError("Проверьте цену");
      return;
    }

    setError(undefined);
    onCreate({
      name,
      category: form.category as CreateProductInput["category"],
      unit: form.unit as CreateProductInput["unit"],
      status,
      quantity,
      estPrice: price,
    });
    setForm(EMPTY);
    setCategoryHint(undefined);
    setUnitHint(undefined);
    setPriceHint(undefined);
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-2xl border border-border bg-card p-4 shadow-soft"
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1.2fr_0.8fr_0.9fr_1fr]">
        <div>
          <Field
            id="name"
            label="Название"
            placeholder="Молоко"
            value={form.name}
            onChange={(e) => {
              set("name", e.target.value);
              setCategoryHint(undefined);
            }}
            error={error}
          />
        </div>

        <div>
          <Select
            id="category"
            label="Категория"
            value={form.category}
            onChange={(e) => {
              set("category", e.target.value);
              setCategoryHint(undefined);
            }}
          >
            {CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </Select>
          {categoryHint && categoryHint !== form.category && (
            <AiSuggestionChip
              text={categoryHint}
              onApply={() => {
                set("category", categoryHint);
                setCategoryHint(undefined);
              }}
              onDismiss={() => setCategoryHint(undefined)}
            />
          )}
        </div>

        <Field
          id="quantity"
          label="Кол-во"
          inputMode="decimal"
          value={form.quantity}
          onChange={(e) => set("quantity", e.target.value)}
        />

        <div>
          <div className="flex items-end gap-1">
            <Select
              id="unit"
              label="Ед."
              className="flex-1"
              value={form.unit}
              onChange={(e) => {
                set("unit", e.target.value);
                setUnitHint(undefined);
              }}
            >
              {UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </Select>
            <AiTriggerButton
              onClick={suggestUnit}
              pending={unitPending}
              disabled={!form.name.trim()}
              label="Подсказать единицу измерения"
            />
          </div>
          {unitHint && (
            <AiSuggestionChip
              text={unitHint}
              onApply={() => {
                set("unit", unitHint);
                setUnitHint(undefined);
              }}
              onDismiss={() => setUnitHint(undefined)}
            />
          )}
        </div>

        <div>
          <div className="flex items-end gap-1">
            <Field
              id="estPrice"
              label="Цена, ₽"
              className="flex-1"
              inputMode="decimal"
              placeholder="—"
              value={form.estPrice}
              onChange={(e) => set("estPrice", e.target.value)}
            />
            <AiTriggerButton
              onClick={estimatePrice}
              pending={pricePending}
              disabled={!form.name.trim()}
              label="Оценить цену с помощью ИИ"
            />
          </div>
          {priceHint !== undefined && (
            <AiSuggestionChip
              text={`${priceHint} ₽`}
              onApply={() => {
                set("estPrice", String(priceHint));
                setPriceHint(undefined);
              }}
              onDismiss={() => setPriceHint(undefined)}
            />
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          <Plus className="h-[18px] w-[18px]" aria-hidden />
          Добавить
        </Button>
        <Button type="button" variant="tonal" onClick={onOpenBulk}>
          <ListPlus className="h-[18px] w-[18px]" aria-hidden />
          Списком
        </Button>
      </div>
    </form>
  );
}
