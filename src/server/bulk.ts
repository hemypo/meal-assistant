import { prisma } from "@/lib/db";
import { runTask } from "@/lib/ai/tasks";
import { resolveCategories, normalizeName } from "@/server/categories";
import type { CreateProductInput } from "@/lib/validation/product";
import type { ProductDTO } from "@/server/products";
import type { ProductStatus } from "@/generated/prisma/enums";

export type BulkDraft = {
  name: string;
  category: string;
  quantity: number;
  unit: string;
};

/**
 * Parse pasted text into editable drafts. Nothing is written to the database
 * here — the user reviews and confirms first (CLAUDE.md §4: AI never silently
 * mutates user data).
 *
 * One AI call parses the text; the category cache then fills categories,
 * costing a second call only for names never seen before.
 */
export async function parseBulkText(
  userId: string,
  text: string,
): Promise<BulkDraft[]> {
  const parsed = await runTask("parse_bulk_list", { text });
  if (parsed.length === 0) return [];

  const cached = await resolveCategories(
    userId,
    parsed.map((item) => item.name),
  );

  return parsed.map((item) => ({
    ...item,
    // A learned mapping beats the parser's guess — it reflects the user's
    // own past corrections for that exact name.
    category: cached.get(normalizeName(item.name)) ?? item.category,
  }));
}

/** Persist confirmed drafts, and learn their (possibly corrected) categories. */
export async function createProductsBulk(
  userId: string,
  items: CreateProductInput[],
  status: ProductStatus,
): Promise<ProductDTO[]> {
  // One INSERT rather than N creates inside a transaction: a 20-item batch
  // blew the interactive-transaction timeout over Neon's pooled connection
  // (P2028). A single statement is atomic on its own and far faster.
  const created = await prisma.product.createManyAndReturn({
    data: items.map((item) => ({
      ...item,
      estPrice: item.estPrice ?? null,
      status,
      userId,
    })),
  });

  // The user may have fixed categories in the preview — record those so the
  // same name is never misclassified again.
  await prisma.categoryMapping.createMany({
    data: items.map((item) => ({
      userId,
      normalizedName: normalizeName(item.name),
      category: item.category,
    })),
    skipDuplicates: true,
  });

  return created.map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    status: p.status,
    quantity: Number(p.quantity.toString()),
    unit: p.unit,
    estPrice: p.estPrice === null ? null : Number(p.estPrice.toString()),
  }));
}
