"use client";

import { Trash2 } from "lucide-react";
import { StatusToggle } from "./StatusToggle";
import { formatPrice, formatQuantity } from "@/lib/utils";
import type { ProductDTO } from "@/server/products";

/** MASTER.md §5 ProductRow: name 15/500, tabular sub-line, StatusToggle right. */
export function ProductRow({
  product,
  onToggle,
  onDelete,
  pending,
}: {
  product: ProductDTO;
  onToggle: () => void;
  onDelete: () => void;
  pending?: boolean;
}) {
  const subLine = [
    `${formatQuantity(product.quantity)} ${product.unit}`,
    product.estPrice === null ? null : formatPrice(product.estPrice),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <li className="group flex items-center gap-3 px-4 py-3 transition-colors duration-[160ms] hover:bg-muted">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-medium">{product.name}</p>
        <p className="tabular text-[13px] font-medium text-muted-foreground">
          {subLine}
        </p>
      </div>

      <StatusToggle
        status={product.status}
        onToggle={onToggle}
        disabled={pending}
      />

      <button
        type="button"
        onClick={onDelete}
        disabled={pending}
        aria-label={`Удалить «${product.name}»`}
        title={`Удалить «${product.name}»`}
        className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl text-muted-foreground transition-colors duration-[160ms] hover:bg-destructive-soft hover:text-destructive focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50"
      >
        <Trash2 className="h-[18px] w-[18px]" aria-hidden />
      </button>
    </li>
  );
}
