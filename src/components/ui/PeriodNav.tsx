"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * MASTER.md §5 PeriodNav: ‹ label › — two 44px icon buttons around a centered
 * 15/700 label with a fixed minimum width so it does not jitter between months.
 */
export function PeriodNav({
  label,
  onPrev,
  onNext,
  prevLabel,
  nextLabel,
}: {
  label: string;
  onPrev: () => void;
  onNext: () => void;
  prevLabel: string;
  nextLabel: string;
}) {
  const button =
    "flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl bg-muted text-foreground transition-colors duration-[160ms] hover:bg-border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={onPrev} aria-label={prevLabel} title={prevLabel} className={button}>
        <ChevronLeft className="h-5 w-5" aria-hidden />
      </button>
      <span className="min-w-[150px] text-center text-[15px] font-bold">
        {label}
      </span>
      <button type="button" onClick={onNext} aria-label={nextLabel} title={nextLabel} className={button}>
        <ChevronRight className="h-5 w-5" aria-hidden />
      </button>
    </div>
  );
}
