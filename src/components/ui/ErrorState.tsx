"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";
import { Button } from "./Button";

/**
 * Shown when data could not be loaded. Deliberately distinct from EmptyState:
 * "you have no receipts" and "we couldn't reach the database" look identical
 * otherwise, which is exactly how people conclude their data was lost.
 */
export function ErrorState({
  title = "Не удалось загрузить",
  description = "Проверьте соединение и попробуйте ещё раз.",
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card px-6 py-12 text-center shadow-soft"
    >
      <div className="flex h-15 w-15 items-center justify-center rounded-full bg-destructive-soft p-4">
        <TriangleAlert className="h-6 w-6 text-destructive" aria-hidden />
      </div>
      <p className="text-[15px] font-bold text-foreground">{title}</p>
      <p className="max-w-72 text-[13px] font-medium text-muted-foreground">
        {description}
      </p>
      {onRetry && (
        <Button variant="tonal" type="button" onClick={onRetry}>
          <RotateCcw className="h-[18px] w-[18px]" aria-hidden />
          Повторить
        </Button>
      )}
    </div>
  );
}

/** Skeleton that reserves the final layout so nothing shifts (MASTER.md §5). */
export function LoadingState({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-live="polite">
      <span className="sr-only">Загружаем данные</span>
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="h-20 animate-pulse rounded-2xl border border-border bg-card"
        />
      ))}
    </div>
  );
}
