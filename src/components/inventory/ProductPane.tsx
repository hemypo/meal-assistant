"use client";

import { PackageOpen, ShoppingCart } from "lucide-react";
import { ProductRow } from "./ProductRow";
import { EmptyState } from "@/components/ui/EmptyState";
import { plural } from "@/lib/utils";
import type { ProductDTO } from "@/server/products";
import type { ProductStatus } from "@/generated/prisma/enums";

/** Category groups, alphabetical inside each group (master plan §4). */
function groupByCategory(products: ProductDTO[]) {
  const groups = new Map<string, ProductDTO[]>();
  for (const product of products) {
    const list = groups.get(product.category) ?? [];
    list.push(product);
    groups.set(product.category, list);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "ru"))
    .map(([category, items]) => ({
      category,
      items: items.sort((a, b) => a.name.localeCompare(b.name, "ru")),
    }));
}

const PANES = {
  IN_STOCK: {
    title: "В наличии",
    dot: "bg-accent",
    icon: PackageOpen,
    emptyTitle: "Пока пусто",
    emptyText: "Добавьте продукты, которые уже есть дома.",
  },
  TO_BUY: {
    title: "Надо купить",
    dot: "bg-secondary",
    icon: ShoppingCart,
    emptyTitle: "Список покупок пуст",
    emptyText: "Отметьте продукты, которых не хватает.",
  },
} as const;

export function ProductPane({
  status,
  products,
  onToggle,
  onDelete,
  pendingIds,
}: {
  status: ProductStatus;
  products: ProductDTO[];
  onToggle: (product: ProductDTO) => void;
  onDelete: (product: ProductDTO) => void;
  pendingIds: Set<string>;
}) {
  const pane = PANES[status];
  const groups = groupByCategory(products);

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
      <header className="flex items-center gap-2.5 border-b border-border px-4 py-3.5">
        <span className={`h-2 w-2 rounded-full ${pane.dot}`} aria-hidden />
        <h2 className="text-[18px] font-bold">{pane.title}</h2>
        <span className="tabular rounded-full bg-muted px-2.5 py-0.5 text-xs font-bold text-muted-foreground">
          {products.length}
        </span>
      </header>

      {products.length === 0 ? (
        <EmptyState
          icon={pane.icon}
          title={pane.emptyTitle}
          description={pane.emptyText}
        />
      ) : (
        <div>
          {groups.map(({ category, items }) => (
            <div key={category}>
              <h3 className="sticky top-0 z-10 flex items-center justify-between bg-muted px-4 py-2 text-[13px] font-bold text-muted-foreground">
                <span>{category}</span>
                <span className="tabular">
                  {items.length}{" "}
                  {plural(items.length, "позиция", "позиции", "позиций")}
                </span>
              </h3>
              <ul className="divide-y divide-border">
                {items.map((product) => (
                  <ProductRow
                    key={product.id}
                    product={product}
                    pending={pendingIds.has(product.id)}
                    onToggle={() => onToggle(product)}
                    onDelete={() => onDelete(product)}
                  />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
