"use client";

import { cn } from "@/lib/utils";
import type { ProductStatus } from "@/generated/prisma/enums";

/**
 * MASTER.md §5 StatusToggle — radius-full pill with a currentColor dot.
 * `title` explains the resulting action, not the current state.
 * Meaning always carries text, never colour alone.
 */
export function StatusToggle({
  status,
  onToggle,
  disabled,
}: {
  status: ProductStatus;
  onToggle: () => void;
  disabled?: boolean;
}) {
  const inStock = status === "IN_STOCK";

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      title={inStock ? "Отметить: надо купить" : "Отметить: в наличии"}
      className={cn(
        "inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full font-bold",
        "px-4 py-2.5 text-[13px] sm:px-3.5 sm:py-[7px]",
        "transition-all duration-[160ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
        "hover:brightness-110 active:scale-[0.96] disabled:opacity-60",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        inStock
          ? "bg-accent-soft text-accent-strong"
          : "bg-secondary-soft text-secondary",
      )}
    >
      <span
        aria-hidden
        className="h-1.5 w-1.5 rounded-full bg-current"
      />
      {inStock ? "В наличии" : "Надо купить"}
    </button>
  );
}
