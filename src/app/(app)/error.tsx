"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";
import { useEffect } from "react";

/**
 * Route-level boundary for the authenticated app. Catches render and server
 * errors that the per-view error states cannot.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Server-side details stay on the server; the digest is the safe handle.
    console.error("[app] route error", error.digest);
  }, [error]);

  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card px-6 py-16 text-center shadow-soft"
    >
      <div className="flex h-15 w-15 items-center justify-center rounded-full bg-destructive-soft p-4">
        <TriangleAlert className="h-6 w-6 text-destructive" aria-hidden />
      </div>
      <h1 className="text-[18px] font-bold">Что-то пошло не так</h1>
      <p className="max-w-80 text-[13px] font-medium text-muted-foreground">
        Раздел не удалось открыть. Данные не пострадали — попробуйте ещё раз.
      </p>
      {error.digest && (
        <p className="tabular text-[11px] font-semibold text-muted-foreground">
          Код: {error.digest}
        </p>
      )}
      <button
        type="button"
        onClick={reset}
        className="mt-1 inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-muted px-5 py-3 text-[15px] font-bold text-foreground transition-colors duration-[160ms] hover:bg-border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <RotateCcw className="h-[18px] w-[18px]" aria-hidden />
        Попробовать снова
      </button>
    </div>
  );
}
