"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Scale } from "lucide-react";
import { useState } from "react";
import { WeightChart } from "./WeightChart";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { PeriodNav } from "@/components/ui/PeriodNav";
import { useToast } from "@/components/ui/Toast";
import {
  addMonths,
  endOfMonth,
  longDate,
  monthLabel,
  startOfMonth,
  todayIso,
} from "@/lib/dates";
import type { WeightOverview } from "@/server/weight";

const ru = (value: number) => String(value).replace(".", ",");

export function WeightView() {
  const queryClient = useQueryClient();
  const toast = useToast();

  const [month, setMonth] = useState(() => startOfMonth(todayIso()));
  const [date, setDate] = useState(todayIso());
  const [weight, setWeight] = useState("");
  const [error, setError] = useState<string>();

  const from = month;
  const to = endOfMonth(month);

  const { data, isLoading } = useQuery({
    queryKey: ["weights", from, to],
    queryFn: async (): Promise<WeightOverview> => {
      const r = await fetch(`/api/weights?from=${from}&to=${to}`);
      if (!r.ok) throw new Error("Не удалось загрузить вес");
      return r.json();
    },
  });

  const save = useMutation({
    mutationFn: async (input: { date: string; weightKg: number }) => {
      const r = await fetch("/api/weights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body.error ?? "Не удалось сохранить");
      return body;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["weights"] });
      setWeight("");
      toast("Вес записан");
    },
    onError: (e) =>
      toast(e instanceof Error ? e.message : "Не удалось сохранить вес"),
  });

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = Number(weight.replace(",", "."));
    if (!Number.isFinite(value) || value < 30 || value > 250) {
      setError("Вес должен быть от 30 до 250 кг");
      return;
    }
    setError(undefined);
    save.mutate({ date, weightKg: value });
  }

  const entries = data?.entries ?? [];
  const goalKg = data?.goalKg ?? 0;
  const latest = data?.latestKg ?? null;
  const toGoal = data?.toGoalKg ?? null;

  // Progress from the range's starting weight toward the goal.
  const startKg = entries.length ? entries[0].weightKg : null;
  const progress =
    startKg === null || latest === null || startKg === goalKg
      ? 0
      : Math.max(
          0,
          Math.min(100, Math.round(((startKg - latest) / (startKg - goalKg)) * 100)),
        );

  return (
    <>
      <ScreenHeader
        kicker="05 · Здоровье"
        title="Вес"
        subtitle={
          isLoading
            ? "Загружаем…"
            : latest !== null
              ? `Текущий вес ${ru(latest)} кг · цель ${ru(goalKg)} кг`
              : "Записей за месяц пока нет"
        }
        action={
          <PeriodNav
            label={monthLabel(month)}
            onPrev={() => setMonth(addMonths(month, -1))}
            onNext={() => setMonth(addMonths(month, 1))}
            prevLabel="Предыдущий месяц"
            nextLabel="Следующий месяц"
          />
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
          <h2 className="mb-4 text-[18px] font-bold">Динамика веса</h2>
          {entries.length > 0 ? (
            <WeightChart data={entries} goalKg={goalKg} />
          ) : (
            <EmptyState
              icon={Scale}
              title="Нет записей за этот месяц"
              description="Добавьте вес справа — график построится сразу."
            />
          )}
        </section>

        <div className="flex flex-col gap-6">
          {/* WeightEntryForm — MASTER.md's template for single-row add forms. */}
          <form
            onSubmit={submit}
            className="rounded-2xl border border-border bg-card p-5 shadow-soft"
          >
            <h2 className="mb-4 text-[18px] font-bold">Записать вес</h2>
            <div className="flex flex-col gap-3">
              <Field
                id="weight-kg"
                label="Вес, кг"
                inputMode="decimal"
                placeholder="78,4"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                error={error}
              />
              <Field
                id="weight-date"
                label="Дата"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
              <p className="text-[13px] font-medium text-muted-foreground">
                {longDate(date)} · одна запись в день
              </p>
              <Button type="submit" disabled={save.isPending} className="w-full">
                {save.isPending ? "Сохраняем…" : "Добавить"}
              </Button>
            </div>
          </form>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <h2 className="mb-3 text-[18px] font-bold">Прогресс</h2>

            <p className="text-[13px] font-semibold text-muted-foreground">
              До цели
            </p>
            <p className="tabular text-[32px] font-extrabold leading-tight tracking-[-0.02em]">
              {toGoal === null
                ? "—"
                : toGoal > 0
                  ? `${ru(Math.abs(toGoal))} кг`
                  : "цель достигнута"}
            </p>

            <div
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Прогресс к цели по весу"
              className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-muted"
            >
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="tabular mt-2 text-[13px] font-medium text-muted-foreground">
              Пройдено {progress}% пути к цели
            </p>

            {data?.avgKcal != null && (
              <p className="tabular mt-4 border-t border-border pt-3 text-[13px] font-medium text-muted-foreground">
                Средняя калорийность по плану:{" "}
                <span className="font-bold text-foreground">
                  {data.avgKcal} ккал/день
                </span>
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
