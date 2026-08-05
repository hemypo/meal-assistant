"use client";

import { useMutation } from "@tanstack/react-query";
import { Info, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { formatPrice } from "@/lib/utils";
import type { SpendingReview as Review } from "@/server/review";

/**
 * The AI read-out. Every figure shown here comes from `review.figures`, which
 * the server computed — the model's prose is displayed alongside them, never
 * as the source of a number.
 */
export function SpendingReview({ month }: { month: string }) {
  const toast = useToast();

  const review = useMutation({
    mutationFn: async (): Promise<Review> => {
      const r = await fetch("/api/ai/finance-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body.error ?? "Не удалось построить разбор");
      return body;
    },
    onError: (e) =>
      toast(e instanceof Error ? e.message : "Не удалось построить разбор"),
  });

  const data = review.data;
  const delta =
    data?.figures.previousTotal === null || data === undefined
      ? null
      : data.figures.total - data.figures.previousTotal;

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <h2 className="mb-1 text-[18px] font-bold">Разбор расходов</h2>
      <p className="mb-4 text-[13px] font-medium text-muted-foreground">
        ИИ читает уже посчитанные итоги за месяц и объясняет, куда ушли деньги.
      </p>

      <Button
        type="button"
        onClick={() => review.mutate()}
        disabled={review.isPending}
        className="w-full"
      >
        {review.isPending ? (
          <>
            <Loader2 className="h-[18px] w-[18px] animate-spin" aria-hidden />
            Gemini думает…
          </>
        ) : (
          <>
            <Sparkles className="h-[18px] w-[18px]" aria-hidden />
            {data ? "Обновить разбор" : "Разобрать месяц"}
          </>
        )}
      </Button>

      {data && (
        <div className="mt-4 flex flex-col gap-3">
          <div className="tabular flex flex-wrap gap-1.5">
            <span className="rounded-full bg-primary-soft px-3 py-1.5 text-[13px] font-bold text-primary">
              Потрачено {formatPrice(data.figures.total)}
            </span>
            <span className="rounded-full bg-muted px-3 py-1.5 text-[13px] font-bold text-muted-foreground">
              Прогноз {formatPrice(data.figures.projected)}
            </span>
            {delta !== null && (
              <span
                className={
                  delta > 0
                    ? "rounded-full bg-secondary-soft px-3 py-1.5 text-[13px] font-bold text-secondary"
                    : "rounded-full bg-accent-soft px-3 py-1.5 text-[13px] font-bold text-accent-strong"
                }
              >
                {delta > 0 ? "+" : "−"}
                {formatPrice(Math.abs(delta))} к прошлому месяцу
              </span>
            )}
          </div>

          <p className="text-[13px] font-medium leading-relaxed">
            {data.summary}
          </p>

          {data.observations.length > 0 && (
            <ul className="flex flex-col gap-1.5">
              {data.observations.map((line) => (
                <li
                  key={line}
                  className="text-[13px] font-medium text-muted-foreground"
                >
                  • {line}
                </li>
              ))}
            </ul>
          )}

          {data.suggestions.length > 0 && (
            <div className="rounded-[10px] bg-muted p-3">
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                Что можно сделать
              </p>
              <ul className="flex flex-col gap-1.5">
                {data.suggestions.map((line) => (
                  <li key={line} className="text-[13px] font-medium">
                    • {line}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="flex items-start gap-2 text-[13px] font-medium text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            Это наблюдения по вашим собственным тратам, а не финансовая
            консультация.
          </p>
        </div>
      )}
    </section>
  );
}
