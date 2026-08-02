"use client";

import { Loader2, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * MASTER.md §5 AiAssistField, button mode: a ✨ trigger plus a dismissible
 * suggestion chip. The suggestion is applied only by an explicit click —
 * AI never writes into a field on its own (CLAUDE.md §4).
 */
export function AiTriggerButton({
  onClick,
  pending,
  label,
  disabled,
}: {
  onClick: () => void;
  pending: boolean;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending || disabled}
      aria-label={label}
      title={label}
      className={cn(
        "flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-[10px]",
        "text-primary transition-colors duration-[160ms]",
        "hover:bg-primary-soft disabled:cursor-default disabled:opacity-40",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
      )}
    >
      {pending ? (
        <Loader2 className="h-[18px] w-[18px] animate-spin" aria-hidden />
      ) : (
        <Sparkles className="h-[18px] w-[18px]" aria-hidden />
      )}
    </button>
  );
}

export function AiSuggestionChip({
  text,
  onApply,
  onDismiss,
}: {
  text: string;
  onApply: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="mt-1.5 flex items-center gap-1">
      <button
        type="button"
        onClick={onApply}
        title="Применить предложение ИИ"
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1.5 text-[13px] font-bold text-primary transition-all duration-[160ms] hover:brightness-110 active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <Sparkles className="h-3.5 w-3.5" aria-hidden />
        {text}
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Отклонить предложение"
        title="Отклонить предложение"
        className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors duration-[160ms] hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <X className="h-3.5 w-3.5" aria-hidden />
      </button>
    </div>
  );
}
