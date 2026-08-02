"use client";

import { Loader2, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { CATEGORIES, cn, plural, UNITS } from "@/lib/utils";
import type { CreateProductInput } from "@/lib/validation/product";
import type { ProductStatus } from "@/generated/prisma/enums";

type Draft = {
  name: string;
  category: string;
  quantity: number;
  unit: string;
};

const PLACEHOLDER = `молоко 2л
куриное филе 1.2кг
гречка 900 г
2 авокадо`;

/**
 * MASTER.md §5 BulkAddModal: textarea → «Разобрать с ИИ» → editable preview
 * → single confirm. The preview is the safety valve — AI output is never
 * written without an explicit user action (CLAUDE.md §4).
 */
export function BulkAddModal({
  open,
  onClose,
  status,
  onConfirmed,
}: {
  open: boolean;
  onClose: () => void;
  status: ProductStatus;
  onConfirmed: (count: number) => void;
}) {
  const [text, setText] = useState("");
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  function reset() {
    setText("");
    setDrafts(null);
    setError(undefined);
    setPending(false);
  }

  function close() {
    reset();
    onClose();
  }

  async function parse() {
    setPending(true);
    setError(undefined);
    try {
      const response = await fetch("/api/products/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "parse", text }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Не удалось разобрать");
      setDrafts(body.drafts as Draft[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось разобрать список");
    } finally {
      setPending(false);
    }
  }

  async function confirm() {
    if (!drafts?.length) return;
    setPending(true);
    setError(undefined);
    try {
      const items: CreateProductInput[] = drafts.map((d) => ({
        name: d.name,
        category: d.category as CreateProductInput["category"],
        unit: d.unit as CreateProductInput["unit"],
        quantity: d.quantity,
        status,
        estPrice: null,
      }));
      const response = await fetch("/api/products/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "confirm", status, items }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Не удалось сохранить");
      onConfirmed(items.length);
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить");
      setPending(false);
    }
  }

  function update(index: number, patch: Partial<Draft>) {
    setDrafts((current) =>
      current
        ? current.map((d, i) => (i === index ? { ...d, ...patch } : d))
        : current,
    );
  }

  return (
    <Modal open={open} onClose={close} title="Добавить списком">
      {drafts === null ? (
        <>
          <div className="flex-1 overflow-y-auto p-5">
            <label
              htmlFor="bulk-text"
              className="mb-1.5 block text-[13px] font-semibold text-muted-foreground"
            >
              Вставьте список — по одной позиции в строке
            </label>
            <textarea
              id="bulk-text"
              autoFocus
              rows={8}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={PLACEHOLDER}
              className="w-full resize-y rounded-[10px] bg-muted px-3.5 py-2.5 text-base font-medium text-foreground placeholder:text-muted-foreground focus:bg-card focus:outline-2 focus:outline-offset-2 focus:outline-ring"
            />
            {error && (
              <p className="mt-2 text-[13px] font-semibold text-destructive">
                {error}
              </p>
            )}
          </div>
          <footer className="flex justify-end gap-2 border-t border-border px-5 py-4">
            <Button variant="tonal" onClick={close} type="button">
              Отмена
            </Button>
            <Button onClick={parse} disabled={!text.trim() || pending} type="button">
              {pending ? (
                <>
                  <Loader2 className="h-[18px] w-[18px] animate-spin" aria-hidden />
                  Gemini думает…
                </>
              ) : (
                <>
                  <Sparkles className="h-[18px] w-[18px]" aria-hidden />
                  Разобрать с ИИ
                </>
              )}
            </Button>
          </footer>
        </>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto p-5">
            <p className="mb-3 flex items-center gap-2 rounded-[10px] bg-muted px-3 py-2.5 text-[13px] font-medium text-muted-foreground">
              <Sparkles className="h-4 w-4 shrink-0 text-primary" aria-hidden />
              Распознано ИИ — проверьте и поправьте перед сохранением.
            </p>

            <ul className="flex flex-col gap-2">
              {drafts.map((draft, index) => (
                <li
                  key={index}
                  className="grid grid-cols-[1fr_auto] gap-2 rounded-[10px] border border-border p-2.5 sm:grid-cols-[2fr_1.4fr_0.7fr_0.7fr_auto] sm:items-center"
                >
                  <input
                    aria-label="Название"
                    value={draft.name}
                    onChange={(e) => update(index, { name: e.target.value })}
                    className="rounded-lg bg-muted px-2.5 py-2 text-[15px] font-medium focus:bg-card focus:outline-2 focus:outline-offset-2 focus:outline-ring"
                  />
                  <select
                    aria-label="Категория"
                    value={draft.category}
                    onChange={(e) => update(index, { category: e.target.value })}
                    className="cursor-pointer rounded-lg bg-muted px-2.5 py-2 text-[13px] font-semibold focus:bg-card focus:outline-2 focus:outline-offset-2 focus:outline-ring max-sm:col-span-2"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <input
                    aria-label="Количество"
                    inputMode="decimal"
                    value={String(draft.quantity)}
                    onChange={(e) =>
                      update(index, {
                        quantity: Number(e.target.value.replace(",", ".")) || 0,
                      })
                    }
                    className="tabular rounded-lg bg-muted px-2.5 py-2 text-[15px] font-medium focus:bg-card focus:outline-2 focus:outline-offset-2 focus:outline-ring"
                  />
                  <select
                    aria-label="Единица"
                    value={draft.unit}
                    onChange={(e) => update(index, { unit: e.target.value })}
                    className="cursor-pointer rounded-lg bg-muted px-2.5 py-2 text-[13px] font-semibold focus:bg-card focus:outline-2 focus:outline-offset-2 focus:outline-ring"
                  >
                    {UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() =>
                      setDrafts((c) => c!.filter((_, i) => i !== index))
                    }
                    aria-label={`Убрать «${draft.name}»`}
                    title={`Убрать «${draft.name}»`}
                    className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl text-muted-foreground transition-colors duration-[160ms] hover:bg-destructive-soft hover:text-destructive focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    <Trash2 className="h-[18px] w-[18px]" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>

            {drafts.length === 0 && (
              <p className="py-8 text-center text-[13px] font-medium text-muted-foreground">
                Все позиции убраны — сохранять нечего.
              </p>
            )}
            {error && (
              <p className="mt-2 text-[13px] font-semibold text-destructive">
                {error}
              </p>
            )}
          </div>

          <footer
            className={cn(
              "flex items-center justify-between gap-2 border-t border-border px-5 py-4",
            )}
          >
            <span className="tabular text-[13px] font-semibold text-muted-foreground">
              {drafts.length}{" "}
              {plural(drafts.length, "позиция", "позиции", "позиций")}
            </span>
            <div className="flex gap-2">
              <Button variant="tonal" onClick={() => setDrafts(null)} type="button">
                Назад
              </Button>
              <Button onClick={confirm} disabled={!drafts.length || pending} type="button">
                {pending ? "Сохраняем…" : "Добавить всё"}
              </Button>
            </div>
          </footer>
        </>
      )}
    </Modal>
  );
}
