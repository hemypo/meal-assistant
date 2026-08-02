"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Receipt } from "lucide-react";
import { useState } from "react";
import { ReceiptEditor } from "./ReceiptEditor";
import { UploadReceiptModal } from "./UploadReceiptModal";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { longDate } from "@/lib/dates";
import { cn, formatPrice, plural } from "@/lib/utils";
import type { ReceiptDTO, ReceiptItemDTO } from "@/server/receipts";

const KEY = ["receipts"];

async function fetchReceipts(): Promise<ReceiptDTO[]> {
  const response = await fetch("/api/receipts");
  if (!response.ok) throw new Error("Не удалось загрузить чеки");
  return response.json();
}

export function ReceiptsView() {
  const queryClient = useQueryClient();
  const toast = useToast();

  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string>();

  const { data: receipts = [], isLoading } = useQuery({
    queryKey: KEY,
    queryFn: fetchReceipts,
  });

  const selected = receipts.find((r) => r.id === selectedId);

  const confirm = useMutation({
    mutationFn: async ({
      items,
      edited,
    }: {
      items: ReceiptItemDTO[];
      edited: boolean;
    }) => {
      // Persist edits first so the transaction confirms what the user sees.
      if (edited) {
        const patch = await fetch(`/api/receipts/${selectedId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            total: items.reduce((sum, i) => sum + i.price, 0),
            items: items.map((i) => ({
              name: i.name,
              category: i.category,
              quantity: i.quantity,
              unit: i.unit,
              price: i.price,
            })),
          }),
        });
        if (!patch.ok) throw new Error("Не удалось сохранить изменения");
      }

      const response = await fetch(`/api/receipts/${selectedId}/confirm`, {
        method: "POST",
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Не удалось подтвердить");
      return body as { merged: number; created: number; amount: number };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: KEY });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast(`Чек подтверждён — ${formatPrice(result.amount)}, запасы обновлены`);
    },
    onError: (e) =>
      toast(e instanceof Error ? e.message : "Не удалось подтвердить чек"),
  });

  const discard = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/receipts/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Не удалось удалить");
    },
    onSuccess: () => {
      setSelectedId(undefined);
      queryClient.invalidateQueries({ queryKey: KEY });
      toast("Черновик удалён");
    },
    onError: () => toast("Не удалось удалить черновик"),
  });

  const drafts = receipts.filter((r) => r.status === "DRAFT").length;
  const subtitle = isLoading
    ? "Загружаем…"
    : `${receipts.length} ${plural(receipts.length, "чек", "чека", "чеков")}` +
      (drafts > 0 ? ` · ${drafts} на проверке` : "");

  const historyList = (
    <ul className="flex flex-col gap-2">
      {receipts.map((receipt) => (
        <li key={receipt.id}>
          <button
            type="button"
            onClick={() => setSelectedId(receipt.id)}
            className={cn(
              "w-full cursor-pointer rounded-2xl border bg-card p-3.5 text-left transition-colors duration-[160ms]",
              receipt.id === selectedId
                ? "border-[1.5px] border-primary shadow-soft"
                : "border-border hover:border-secondary",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-[15px] font-bold">
                {receipt.store ?? "Без названия"}
              </span>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold",
                  receipt.status === "DRAFT"
                    ? "bg-secondary-soft text-secondary"
                    : "bg-accent-soft text-accent-strong",
                )}
              >
                {receipt.status === "DRAFT" ? "черновик" : "подтверждён"}
              </span>
            </div>
            <p className="tabular mt-0.5 text-[13px] font-medium text-muted-foreground">
              {receipt.purchasedAt ? longDate(receipt.purchasedAt) : "без даты"}
              {" · "}
              {receipt.items.length}{" "}
              {plural(receipt.items.length, "позиция", "позиции", "позиций")}
            </p>
            <p className="tabular mt-1 text-[15px] font-extrabold">
              {receipt.total !== null ? formatPrice(receipt.total) : "—"}
            </p>
          </button>
        </li>
      ))}
    </ul>
  );

  const editor = selected && (
    <ReceiptEditor
      key={selected.id}
      receipt={selected}
      busy={confirm.isPending || discard.isPending}
      onBack={() => setSelectedId(undefined)}
      onConfirm={(items, edited) => confirm.mutate({ items, edited })}
      onDiscard={() => discard.mutate(selected.id)}
      onInvalidEdit={() => toast("Не сохранено: проверьте значение")}
    />
  );

  return (
    <>
      <ScreenHeader
        kicker="03 · Покупки"
        title="Чеки"
        subtitle={subtitle}
        action={
          <Button onClick={() => setUploadOpen(true)}>
            <Plus className="h-[18px] w-[18px]" aria-hidden />
            Новый чек
          </Button>
        }
      />

      {receipts.length === 0 && !isLoading ? (
        <div className="rounded-2xl border border-border bg-card shadow-soft">
          <EmptyState
            icon={Receipt}
            title="Чеков пока нет"
            description="Сфотографируйте чек или вставьте его текст — ИИ разберёт позиции."
          />
        </div>
      ) : (
        <>
          {/* Desktop split: 300px history + 1fr editor (MASTER.md §4). */}
          <div className="hidden gap-6 lg:grid lg:grid-cols-[300px_1fr]">
            <div>{historyList}</div>
            {selected ? (
              editor
            ) : (
              <div className="flex items-center justify-center rounded-2xl border border-border bg-card shadow-soft">
                <EmptyState
                  icon={Receipt}
                  title="Выберите чек"
                  description="Слева — история чеков. Черновики можно поправить и подтвердить."
                />
              </div>
            )}
          </div>

          {/* Mobile: list ↔ detail with a back button. */}
          <div className="lg:hidden">{selected ? editor : historyList}</div>
        </>
      )}

      <UploadReceiptModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onCreated={(receipt) => {
          queryClient.invalidateQueries({ queryKey: KEY });
          setSelectedId(receipt.id);
          toast(
            `Распознано ${receipt.items.length} ${plural(receipt.items.length, "позиция", "позиции", "позиций")}`,
          );
        }}
      />
    </>
  );
}
