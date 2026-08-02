"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Select } from "@/components/ui/Field";
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
 * Single-row add form per MASTER.md §5 (WeightEntryForm is the template):
 * visible labels, Enter submits, decimal inputs accept comma or dot.
 */
export function AddProductForm({
  status,
  onCreate,
  pending,
}: {
  status: ProductStatus;
  onCreate: (input: CreateProductInput) => void;
  pending: boolean;
}) {
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string>();

  function set(key: keyof typeof EMPTY, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
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
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-2xl border border-border bg-card p-4 shadow-soft"
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1.2fr_0.8fr_0.8fr_1fr]">
        <Field
          id="name"
          label="Название"
          placeholder="Молоко"
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          error={error}
        />
        <Select
          id="category"
          label="Категория"
          value={form.category}
          onChange={(e) => set("category", e.target.value)}
        >
          {CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </Select>
        <Field
          id="quantity"
          label="Кол-во"
          inputMode="decimal"
          value={form.quantity}
          onChange={(e) => set("quantity", e.target.value)}
        />
        <Select
          id="unit"
          label="Ед."
          value={form.unit}
          onChange={(e) => set("unit", e.target.value)}
        >
          {UNITS.map((unit) => (
            <option key={unit} value={unit}>
              {unit}
            </option>
          ))}
        </Select>
        <Field
          id="estPrice"
          label="Цена, ₽"
          inputMode="decimal"
          placeholder="—"
          value={form.estPrice}
          onChange={(e) => set("estPrice", e.target.value)}
        />
      </div>

      <Button type="submit" disabled={pending} className="mt-3 w-full sm:w-auto">
        <Plus className="h-[18px] w-[18px]" aria-hidden />
        Добавить
      </Button>
    </form>
  );
}
