"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Select } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { CATEGORIES, cn, formatPrice } from "@/lib/utils";
import type { BudgetDTO } from "@/server/budgets";

const OVERALL = "";

/** MASTER.md §5 ProgressBar, with an over-run made visible rather than clipped. */
function BudgetBar({ budget }: { budget: BudgetDTO }) {
  const width = Math.min(100, budget.usedPct);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[15px] font-bold">
          {budget.category || "Всего за месяц"}
        </span>
        <span
          className={cn(
            "tabular text-[13px] font-bold",
            budget.overspent ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {formatPrice(budget.spent)} / {formatPrice(budget.limitAmount)}
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-300",
            budget.overspent ? "bg-destructive" : "bg-accent",
          )}
          style={{ width: `${width}%` }}
        />
      </div>
      <p
        className={cn(
          "tabular text-[13px] font-semibold",
          budget.overspent ? "text-destructive" : "text-muted-foreground",
        )}
      >
        {budget.overspent
          ? `Превышено на ${formatPrice(Math.abs(budget.remaining))}`
          : `Осталось ${formatPrice(budget.remaining)} · ${budget.usedPct}%`}
      </p>
    </div>
  );
}

export function BudgetPanel({ month }: { month: string }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [category, setCategory] = useState(OVERALL);
  const [limit, setLimit] = useState("");

  const { data: budgets = [] } = useQuery({
    queryKey: ["budgets", month],
    queryFn: async (): Promise<BudgetDTO[]> => {
      const r = await fetch(`/api/budgets?month=${month}`);
      if (!r.ok) throw new Error("Не удалось загрузить лимиты");
      return r.json();
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const value = Number(limit.replace(",", "."));
      if (!Number.isFinite(value) || value < 0) {
        throw new Error("Проверьте сумму лимита");
      }
      const r = await fetch("/api/budgets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, category, limitAmount: value }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body.error ?? "Не удалось сохранить лимит");
      return body as BudgetDTO[];
    },
    onSuccess: (next) => {
      queryClient.setQueryData(["budgets", month], next);
      setLimit("");
      toast("Лимит сохранён");
    },
    onError: (e) =>
      toast(e instanceof Error ? e.message : "Не удалось сохранить лимит"),
  });

  const remove = useMutation({
    mutationFn: async (target: string) => {
      const r = await fetch("/api/budgets", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, category: target }),
      });
      if (!r.ok) throw new Error("Не удалось удалить лимит");
      return r.json() as Promise<BudgetDTO[]>;
    },
    onSuccess: (next) => {
      queryClient.setQueryData(["budgets", month], next);
      toast("Лимит удалён");
    },
    onError: () => toast("Не удалось удалить лимит"),
  });

  const overspent = budgets.filter((b) => b.overspent);

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <h2 className="mb-1 text-[18px] font-bold">Лимиты</h2>
      <p className="mb-4 text-[13px] font-medium text-muted-foreground">
        Сколько вы готовы потратить за месяц — на всё или по категориям.
      </p>

      {overspent.length > 0 && (
        <p className="mb-4 flex items-start gap-2 rounded-[10px] bg-destructive-soft px-3 py-2.5 text-[13px] font-semibold text-destructive">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          Превышено лимитов: {overspent.length}
        </p>
      )}

      {budgets.length > 0 && (
        <ul className="mb-5 flex flex-col gap-4">
          {budgets.map((budget) => (
            <li key={budget.category} className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <BudgetBar budget={budget} />
              </div>
              <button
                type="button"
                onClick={() => remove.mutate(budget.category)}
                aria-label={`Удалить лимит «${budget.category || "всего"}»`}
                title="Удалить лимит"
                className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl text-muted-foreground transition-colors duration-[160ms] hover:bg-destructive-soft hover:text-destructive focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-3 sm:grid-cols-[1.4fr_1fr_auto] sm:items-end">
        <Select
          id="budget-category"
          label="На что"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value={OVERALL}>Всего за месяц</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
        <Field
          id="budget-limit"
          label="Лимит, ₽"
          inputMode="decimal"
          placeholder="20000"
          value={limit}
          onChange={(e) => setLimit(e.target.value)}
        />
        <Button
          type="button"
          onClick={() => save.mutate()}
          disabled={!limit.trim() || save.isPending}
        >
          <Plus className="h-[18px] w-[18px]" aria-hidden />
          Задать
        </Button>
      </div>
    </section>
  );
}
