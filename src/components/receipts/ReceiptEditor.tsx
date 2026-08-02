"use client";

import { ArrowLeft, Check, RotateCcw, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import { ReceiptDraftRow } from "./ReceiptDraftRow";
import { Button } from "@/components/ui/Button";
import { longDate } from "@/lib/dates";
import { formatPrice } from "@/lib/utils";
import type { ReceiptDTO, ReceiptItemDTO } from "@/server/receipts";

/**
 * Mounted with `key={receipt.id}` so switching receipts resets the draft
 * state by remounting — no syncing effect, which is React's own guidance and
 * what the `set-state-in-effect` lint rule enforces.
 */
export function ReceiptEditor({
  receipt,
  busy,
  onBack,
  onConfirm,
  onDiscard,
  onInvalidEdit,
}: {
  receipt: ReceiptDTO;
  busy: boolean;
  onBack: () => void;
  onConfirm: (items: ReceiptItemDTO[], edited: boolean) => void;
  onDiscard: () => void;
  onInvalidEdit: () => void;
}) {
  const [items, setItems] = useState<ReceiptItemDTO[]>(receipt.items);
  const [editedIds, setEditedIds] = useState<Set<string>>(new Set());

  const isDraft = receipt.status === "DRAFT";
  const itemsTotal = items.reduce((sum, i) => sum + i.price, 0);
  // Once lines are edited the parsed total is stale, so show the live sum.
  const displayTotal =
    editedIds.size > 0 || receipt.total === null ? itemsTotal : receipt.total;

  function patch(id: string, next: Partial<ReceiptItemDTO>) {
    setItems((current) =>
      current.map((i) => (i.id === id ? { ...i, ...next } : i)),
    );
    setEditedIds((current) => new Set(current).add(id));
  }

  return (
    <section className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
      <header className="border-b border-border px-5 py-4">
        <button
          type="button"
          onClick={onBack}
          className="mb-2 inline-flex cursor-pointer items-center gap-1.5 text-[13px] font-bold text-muted-foreground transition-colors duration-[160ms] hover:text-foreground lg:hidden"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Все чеки
        </button>
        <h2 className="text-[18px] font-bold">
          {receipt.store ?? "Без названия"}
        </h2>
        <p className="tabular text-[13px] font-medium text-muted-foreground">
          {receipt.purchasedAt ? longDate(receipt.purchasedAt) : "без даты"}
        </p>
      </header>

      <div className="flex-1 overflow-y-auto p-5">
        {isDraft && (
          <p className="mb-3 flex items-start gap-2 rounded-[10px] bg-muted px-3 py-2.5 text-[13px] font-medium text-muted-foreground">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
            Черновик распознан ИИ — проверьте позиции и суммы. Нажмите на
            значение, чтобы исправить.
          </p>
        )}

        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-[15px] font-bold">Все позиции удалены</p>
            <p className="text-[13px] font-medium text-muted-foreground">
              Пустой чек нельзя подтвердить
            </p>
            <Button
              variant="tonal"
              type="button"
              onClick={() => {
                setItems(receipt.items);
                setEditedIds(new Set());
              }}
            >
              <RotateCcw className="h-[18px] w-[18px]" aria-hidden />
              Восстановить черновик
            </Button>
          </div>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {items.map((item) =>
              isDraft ? (
                <ReceiptDraftRow
                  key={item.id}
                  item={item}
                  edited={editedIds.has(item.id)}
                  onChange={(next) => patch(item.id, next)}
                  onRemove={() => {
                    setItems((c) => c.filter((i) => i.id !== item.id));
                    setEditedIds((c) => new Set(c).add(item.id));
                  }}
                  onInvalid={onInvalidEdit}
                />
              ) : (
                <li key={item.id} className="flex items-center gap-2 px-2 py-1.5">
                  <span className="flex-1 text-[15px] font-medium">{item.name}</span>
                  <span className="tabular text-[13px] text-muted-foreground">
                    {item.quantity} {item.unit}
                  </span>
                  <span className="tabular min-w-[86px] text-right text-[15px] font-bold">
                    {formatPrice(item.price)}
                  </span>
                </li>
              ),
            )}
          </ul>
        )}
      </div>

      {isDraft && (
        <footer className="flex items-center justify-between gap-3 border-t border-border px-5 py-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Итого
            </p>
            <p className="tabular text-[22px] font-extrabold">
              {formatPrice(displayTotal)}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onDiscard}
              disabled={busy}
              aria-label="Удалить черновик"
              title="Удалить черновик"
              className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-2xl text-muted-foreground transition-colors duration-[160ms] hover:bg-destructive-soft hover:text-destructive disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <Trash2 className="h-[18px] w-[18px]" aria-hidden />
            </button>
            <Button
              onClick={() => onConfirm(items, editedIds.size > 0)}
              disabled={items.length === 0 || busy}
              type="button"
            >
              <Check className="h-[18px] w-[18px]" aria-hidden />
              {busy ? "Подтверждаем…" : "Подтвердить чек"}
            </Button>
          </div>
        </footer>
      )}
    </section>
  );
}
