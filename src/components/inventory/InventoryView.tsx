"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AddProductForm } from "./AddProductForm";
import { BulkAddModal } from "./BulkAddModal";
import { ProductPane } from "./ProductPane";
import { ScreenHeader } from "@/components/ScreenHeader";
import { ErrorState } from "@/components/ui/ErrorState";
import { useToast } from "@/components/ui/Toast";
import { cn, plural } from "@/lib/utils";
import type { CreateProductInput } from "@/lib/validation/product";
import type { ProductDTO } from "@/server/products";
import type { ProductStatus } from "@/generated/prisma/enums";

const KEY = ["products"];

async function fetchProducts(): Promise<ProductDTO[]> {
  const response = await fetch("/api/products");
  if (!response.ok) throw new Error("Не удалось загрузить продукты");
  return response.json();
}

export function InventoryView() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [tab, setTab] = useState<ProductStatus>("IN_STOCK");
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);

  const { data: products = [], isLoading, isError, refetch } = useQuery({
    queryKey: KEY,
    queryFn: fetchProducts,
  });

  function markPending(id: string, pending: boolean) {
    setPendingIds((current) => {
      const next = new Set(current);
      if (pending) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  const create = useMutation({
    mutationFn: async (input: CreateProductInput) => {
      const response = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) throw new Error("Не удалось добавить продукт");
      return response.json() as Promise<ProductDTO>;
    },
    onSuccess: (product) => {
      queryClient.setQueryData<ProductDTO[]>(KEY, (current = []) => [
        ...current,
        product,
      ]);
      toast(`«${product.name}» добавлен`);
    },
    onError: () => toast("Не удалось добавить продукт"),
  });

  // Optimistic status toggle — the most-used action must feel instant (§11).
  const toggle = useMutation({
    mutationFn: async (product: ProductDTO) => {
      const status: ProductStatus =
        product.status === "IN_STOCK" ? "TO_BUY" : "IN_STOCK";
      const response = await fetch(`/api/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error("Не удалось изменить статус");
      return response.json() as Promise<ProductDTO>;
    },
    onMutate: async (product) => {
      markPending(product.id, true);
      await queryClient.cancelQueries({ queryKey: KEY });
      const previous = queryClient.getQueryData<ProductDTO[]>(KEY);
      queryClient.setQueryData<ProductDTO[]>(KEY, (current = []) =>
        current.map((p) =>
          p.id === product.id
            ? { ...p, status: p.status === "IN_STOCK" ? "TO_BUY" : "IN_STOCK" }
            : p,
        ),
      );
      return { previous };
    },
    onError: (_error, _product, context) => {
      if (context?.previous) queryClient.setQueryData(KEY, context.previous);
      toast("Не удалось изменить статус");
    },
    onSettled: (_data, _error, product) => markPending(product.id, false),
  });

  const remove = useMutation({
    mutationFn: async (product: ProductDTO) => {
      const response = await fetch(`/api/products/${product.id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Не удалось удалить продукт");
    },
    onMutate: async (product) => {
      markPending(product.id, true);
      await queryClient.cancelQueries({ queryKey: KEY });
      const previous = queryClient.getQueryData<ProductDTO[]>(KEY);
      queryClient.setQueryData<ProductDTO[]>(KEY, (current = []) =>
        current.filter((p) => p.id !== product.id),
      );
      return { previous };
    },
    onSuccess: (_data, product) => toast(`«${product.name}» удалён`),
    onError: (_error, _product, context) => {
      if (context?.previous) queryClient.setQueryData(KEY, context.previous);
      toast("Не удалось удалить продукт");
    },
    onSettled: (_data, _error, product) => markPending(product.id, false),
  });

  const inStock = products.filter((p) => p.status === "IN_STOCK");
  const toBuy = products.filter((p) => p.status === "TO_BUY");

  const subtitle = isLoading
    ? "Загружаем…"
    : `${inStock.length} ${plural(inStock.length, "позиция", "позиции", "позиций")} в наличии · ${toBuy.length} в списке покупок`;

  // A failed load must not look like an empty pantry.
  if (isError && products.length === 0) {
    return (
      <>
        <ScreenHeader
          kicker="01 · Кладовая"
          title="Запасы"
          subtitle="Не удалось загрузить"
        />
        <ErrorState
          description="Продукты не загрузились. Данные на месте — попробуйте ещё раз."
          onRetry={() => refetch()}
        />
      </>
    );
  }

  return (
    <>
      <ScreenHeader
        kicker="01 · Кладовая"
        title="Запасы"
        subtitle={subtitle}
      />

      <AddProductForm
        status={tab}
        pending={create.isPending}
        onCreate={(input) => create.mutate(input)}
        onOpenBulk={() => setBulkOpen(true)}
      />

      <BulkAddModal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        status={tab}
        onConfirmed={(count) => {
          queryClient.invalidateQueries({ queryKey: KEY });
          toast(
            `Добавлено ${count} ${plural(count, "позиция", "позиции", "позиций")}`,
          );
        }}
      />

      {/* Mobile: segmented tabs. Desktop: both panes side by side (§4). */}
      <div className="mt-6 lg:hidden">
        <div
          role="tablist"
          aria-label="Фильтр запасов"
          className="flex gap-1 rounded-full bg-muted p-1"
        >
          {(["IN_STOCK", "TO_BUY"] as const).map((value) => {
            const active = tab === value;
            const count = value === "IN_STOCK" ? inStock.length : toBuy.length;
            return (
              <button
                key={value}
                role="tab"
                aria-selected={active}
                onClick={() => setTab(value)}
                className={cn(
                  "flex-1 cursor-pointer rounded-full px-4 py-2 text-[13px] font-bold transition-all duration-[160ms]",
                  active
                    ? value === "IN_STOCK"
                      ? "bg-card text-accent-strong shadow-soft"
                      : "bg-card text-secondary shadow-soft"
                    : "text-muted-foreground",
                )}
              >
                {value === "IN_STOCK" ? "В наличии" : "Надо купить"} ·{" "}
                <span className="tabular">{count}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-4">
          <ProductPane
            status={tab}
            products={tab === "IN_STOCK" ? inStock : toBuy}
            pendingIds={pendingIds}
            onToggle={(product) => toggle.mutate(product)}
            onDelete={(product) => remove.mutate(product)}
          />
        </div>
      </div>

      <div className="mt-6 hidden gap-6 lg:grid lg:grid-cols-2">
        <ProductPane
          status="IN_STOCK"
          products={inStock}
          pendingIds={pendingIds}
          onToggle={(product) => toggle.mutate(product)}
          onDelete={(product) => remove.mutate(product)}
        />
        <ProductPane
          status="TO_BUY"
          products={toBuy}
          pendingIds={pendingIds}
          onToggle={(product) => toggle.mutate(product)}
          onDelete={(product) => remove.mutate(product)}
        />
      </div>
    </>
  );
}
