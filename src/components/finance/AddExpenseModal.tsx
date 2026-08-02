"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, Select } from "@/components/ui/Field";
import { EXPENSE_CATEGORIES } from "@/lib/validation/finance";
import { todayIso } from "@/lib/dates";

export function AddExpenseModal({
  open,
  onClose,
  onCreate,
  pending,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (input: {
    date: string;
    category: string;
    amount: number;
    note: string | null;
  }) => void;
  pending: boolean;
}) {
  const [date, setDate] = useState(todayIso());
  const [category, setCategory] = useState<string>("Продукты");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string>();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = Number(amount.replace(",", "."));
    if (!Number.isFinite(value) || value <= 0) {
      setError("Сумма должна быть больше 0");
      return;
    }
    setError(undefined);
    onCreate({
      date,
      category,
      amount: value,
      note: note.trim() === "" ? null : note.trim(),
    });
    setAmount("");
    setNote("");
  }

  return (
    <Modal open={open} onClose={onClose} title="Добавить расход">
      <form onSubmit={submit} className="flex flex-col">
        <div className="flex flex-col gap-3 p-5">
          <Field
            id="expense-amount"
            label="Сумма, ₽"
            inputMode="decimal"
            placeholder="850"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            error={error}
            autoFocus
          />
          <Select
            id="expense-category"
            label="Категория"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
          <Field
            id="expense-date"
            label="Дата"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <Field
            id="expense-note"
            label="Заметка"
            placeholder="необязательно"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        <footer className="flex justify-end gap-2 border-t border-border px-5 py-4">
          <Button variant="tonal" type="button" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Сохраняем…" : "Добавить"}
          </Button>
        </footer>
      </form>
    </Modal>
  );
}
