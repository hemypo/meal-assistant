"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart3, Plus, Receipt, Trash2 } from "lucide-react";
import { useState } from "react";
import { AddExpenseModal } from "./AddExpenseModal";
import { CategoryDonut } from "./CategoryDonut";
import { TrendChart } from "./TrendChart";
import { ScreenHeader } from "@/components/ScreenHeader";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PeriodNav } from "@/components/ui/PeriodNav";
import { StatCard } from "@/components/ui/StatCard";
import { useToast } from "@/components/ui/Toast";
import {
  addMonths,
  endOfMonth,
  longDate,
  monthLabel,
  startOfMonth,
  todayIso,
} from "@/lib/dates";
import { formatPrice, plural } from "@/lib/utils";
import type { AnalyticsSummary, ExpenseDTO } from "@/server/analytics";

export function FinanceView() {
  const queryClient = useQueryClient();
  const toast = useToast();

  const [month, setMonth] = useState(() => startOfMonth(todayIso()));
  const [addOpen, setAddOpen] = useState(false);

  const from = month;
  const to = endOfMonth(month);
  const range = `from=${from}&to=${to}`;

  const { data: summary, isLoading, isError, refetch } = useQuery({
    queryKey: ["analytics", from, to],
    queryFn: async (): Promise<AnalyticsSummary> => {
      const r = await fetch(`/api/analytics/summary?${range}`);
      if (!r.ok) throw new Error("Не удалось загрузить аналитику");
      return r.json();
    },
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ["expenses", from, to],
    queryFn: async (): Promise<ExpenseDTO[]> => {
      const r = await fetch(`/api/expenses?${range}`);
      if (!r.ok) throw new Error("Не удалось загрузить расходы");
      return r.json();
    },
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["analytics"] });
    queryClient.invalidateQueries({ queryKey: ["expenses"] });
  }

  const create = useMutation({
    mutationFn: async (input: {
      date: string;
      category: string;
      amount: number;
      note: string | null;
    }) => {
      const r = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!r.ok) throw new Error("Не удалось добавить расход");
      return r.json() as Promise<ExpenseDTO>;
    },
    onSuccess: (expense) => {
      refresh();
      setAddOpen(false);
      toast(`Расход ${formatPrice(expense.amount)} добавлен`);
    },
    onError: () => toast("Не удалось добавить расход"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/expenses/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("Не удалось удалить");
    },
    onSuccess: () => {
      refresh();
      toast("Расход удалён");
    },
    onError: () => toast("Не удалось удалить расход"),
  });

  const total = summary?.total ?? 0;
  const count = summary?.count ?? 0;
  const topCategory = summary?.byCategory[0];
  const daysWithSpend = summary?.trend.length ?? 0;
  const avgPerDay = daysWithSpend === 0 ? 0 : total / daysWithSpend;

  // A failed load must not be mistaken for "no data".
  if (isError && !summary) {
    return (
      <>
        <ScreenHeader
          kicker="04 · Деньги"
          title="Финансы"
          subtitle="Не удалось загрузить"
        />
        <ErrorState
          description="Аналитика не загрузилась. Расходы на месте — попробуйте ещё раз."
          onRetry={() => refetch()}
        />
      </>
    );
  }

  return (
    <>
      <ScreenHeader
        kicker="04 · Деньги"
        title="Финансы"
        subtitle={
          isLoading
            ? "Загружаем…"
            : `${count} ${plural(count, "трата", "траты", "трат")} за месяц`
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <PeriodNav
              label={monthLabel(month)}
              onPrev={() => setMonth(addMonths(month, -1))}
              onNext={() => setMonth(addMonths(month, 1))}
              prevLabel="Предыдущий месяц"
              nextLabel="Следующий месяц"
            />
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="h-[18px] w-[18px]" aria-hidden />
              Расход
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Потрачено за месяц" value={formatPrice(total)} />
        <StatCard
          label="В среднем в день"
          value={formatPrice(Math.round(avgPerDay))}
          delta={
            daysWithSpend > 0
              ? `по ${daysWithSpend} ${plural(daysWithSpend, "дню", "дням", "дням")} с тратами`
              : undefined
          }
        />
        <StatCard
          label="Больше всего"
          value={topCategory ? topCategory.category : "—"}
          delta={
            topCategory
              ? `${formatPrice(topCategory.amount)} · ${topCategory.share}%`
              : undefined
          }
          deltaTone="up"
        />
      </div>

      {count === 0 && !isLoading ? (
        <div className="mt-6 rounded-2xl border border-border bg-card shadow-soft">
          <EmptyState
            icon={BarChart3}
            title="За этот месяц трат нет"
            description="Подтвердите чек или добавьте расход вручную — графики появятся сразу."
          />
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            {summary && summary.byCategory.length > 0 && (
              <CategoryDonut data={summary.byCategory} total={summary.total} />
            )}
            {summary && summary.trend.length > 0 && (
              <TrendChart data={summary.trend} />
            )}
          </div>

          <section className="mt-6 overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
            <h2 className="border-b border-border px-5 py-3.5 text-[18px] font-bold">
              Все траты
            </h2>
            <ul className="divide-y divide-border">
              {expenses.map((expense) => (
                <li key={expense.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium">
                      {expense.note ?? expense.category}
                    </p>
                    <p className="tabular text-[13px] font-medium text-muted-foreground">
                      {longDate(expense.date)} · {expense.category}
                      {expense.receiptId ? " · из чека" : ""}
                    </p>
                  </div>
                  <span className="tabular text-[15px] font-bold">
                    {formatPrice(expense.amount)}
                  </span>
                  <button
                    type="button"
                    onClick={() => remove.mutate(expense.id)}
                    aria-label={`Удалить расход ${formatPrice(expense.amount)}`}
                    title="Удалить расход"
                    className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl text-muted-foreground transition-colors duration-[160ms] hover:bg-destructive-soft hover:text-destructive focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    <Trash2 className="h-[18px] w-[18px]" aria-hidden />
                  </button>
                </li>
              ))}
              {expenses.length === 0 && (
                <li>
                  <EmptyState
                    icon={Receipt}
                    title="Список пуст"
                    description="Траты за этот месяц появятся здесь."
                  />
                </li>
              )}
            </ul>
          </section>
        </>
      )}

      <AddExpenseModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreate={(input) => create.mutate(input)}
        pending={create.isPending}
      />
    </>
  );
}
