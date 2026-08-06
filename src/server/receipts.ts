import { prisma } from "@/lib/db";
import { runTask } from "@/lib/ai/tasks";
import { normalizeName, resolveCategories } from "@/server/categories";
import { fromIsoDate, toIsoDate } from "@/server/mealplan";
import type {
  CreateReceiptInput,
  UpdateReceiptInput,
} from "@/lib/validation/receipt";
import type { ReceiptSource, ReceiptStatus } from "@/generated/prisma/enums";

const EXPENSE_CATEGORY = "Продукты";

export type ReceiptItemDTO = {
  id: string;
  name: string;
  category: string | null;
  quantity: number;
  unit: string;
  price: number;
};

export type ReceiptDTO = {
  id: string;
  status: ReceiptStatus;
  source: ReceiptSource;
  store: string | null;
  /** YYYY-MM-DD */
  purchasedAt: string | null;
  total: number | null;
  imageUrl: string | null;
  createdAt: string;
  items: ReceiptItemDTO[];
};

type Decimalish = { toString(): string };

type ReceiptRow = {
  id: string;
  status: ReceiptStatus;
  source: ReceiptSource;
  store: string | null;
  purchasedAt: Date | null;
  total: Decimalish | null;
  imageUrl: string | null;
  createdAt: Date;
  items: {
    id: string;
    name: string;
    category: string | null;
    quantity: Decimalish;
    unit: string;
    price: Decimalish;
  }[];
};

function toDTO(receipt: ReceiptRow): ReceiptDTO {
  return {
    id: receipt.id,
    status: receipt.status,
    source: receipt.source,
    store: receipt.store,
    purchasedAt: receipt.purchasedAt ? toIsoDate(receipt.purchasedAt) : null,
    total: receipt.total === null ? null : Number(receipt.total.toString()),
    imageUrl: receipt.imageUrl,
    createdAt: receipt.createdAt.toISOString(),
    items: receipt.items.map((i) => ({
      id: i.id,
      name: i.name,
      category: i.category,
      quantity: Number(i.quantity.toString()),
      unit: i.unit,
      price: Number(i.price.toString()),
    })),
  };
}

export async function listReceipts(userId: string): Promise<ReceiptDTO[]> {
  const receipts = await prisma.receipt.findMany({
    where: { userId },
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });
  return receipts.map(toDTO);
}

export async function getReceipt(
  userId: string,
  id: string,
): Promise<ReceiptDTO | null> {
  const receipt = await prisma.receipt.findFirst({
    where: { id, userId },
    include: { items: true },
  });
  return receipt ? toDTO(receipt) : null;
}

/**
 * Parse a photo or pasted text into a DRAFT receipt. Nothing touches inventory
 * here — the user reviews first (CLAUDE.md §4).
 */
export async function createDraftReceipt(
  userId: string,
  input: CreateReceiptInput,
  imageUrl: string | null,
): Promise<ReceiptDTO> {
  const parsed = await runTask(
    "parse_receipt",
    input.source === "PHOTO"
      ? { imageBase64: input.imageBase64, mimeType: input.mimeType }
      : { rawText: input.rawText },
  );

  // The model already guessed categories; a learned mapping beats its guess
  // because it reflects the user's own past corrections.
  const learned = await resolveCategories(
    userId,
    parsed.items.map((i) => i.name),
  );

  const receipt = await prisma.receipt.create({
    data: {
      userId,
      status: "DRAFT",
      source: input.source,
      store: parsed.store ?? null,
      purchasedAt: parsed.purchasedAt ? fromIsoDate(parsed.purchasedAt) : null,
      total: parsed.total ?? null,
      imageUrl,
      rawText: input.source === "TEXT" ? input.rawText : null,
      items: {
        create: parsed.items.map((item) => ({
          name: item.name,
          category: learned.get(normalizeName(item.name)) ?? item.category ?? null,
          quantity: item.quantity,
          unit: item.unit,
          price: item.price,
        })),
      },
    },
    include: { items: true },
  });

  return toDTO(receipt);
}

/** Edit a draft before confirming. Confirmed receipts are immutable. */
export async function updateDraftReceipt(
  userId: string,
  id: string,
  input: UpdateReceiptInput,
): Promise<ReceiptDTO | null | "NOT_DRAFT"> {
  const existing = await prisma.receipt.findFirst({
    where: { id, userId },
    select: { status: true },
  });
  if (!existing) return null;
  if (existing.status !== "DRAFT") return "NOT_DRAFT";

  await prisma.receipt.update({
    where: { id },
    data: {
      ...(input.store !== undefined ? { store: input.store } : {}),
      ...(input.purchasedAt !== undefined
        ? {
            purchasedAt: input.purchasedAt
              ? fromIsoDate(input.purchasedAt)
              : null,
          }
        : {}),
      ...(input.total !== undefined ? { total: input.total } : {}),
      ...(input.items
        ? {
            // Replacing wholesale keeps the editor simple and matches how the
            // UI sends the full edited list back.
            items: {
              deleteMany: {},
              create: input.items.map((item) => ({
                name: item.name,
                category: item.category ?? null,
                quantity: item.quantity,
                unit: item.unit,
                price: item.price,
              })),
            },
          }
        : {}),
    },
  });

  return getReceipt(userId, id);
}

export type ConfirmResult =
  | { ok: true; merged: number; created: number; amount: number }
  | { ok: false; reason: "NOT_FOUND" | "NOT_DRAFT" | "EMPTY" };

/**
 * Thrown inside the confirm transaction when another request already claimed
 * the receipt. Used to roll the transaction back — it never reaches the client,
 * which sees a plain "already confirmed" result.
 */
class AlreadyConfirmedError extends Error {}

/**
 * THE atomic confirm (master plan §9.1, CLAUDE.md §4).
 *
 * One transaction: every item merges into Product(IN_STOCK) by normalised
 * name, an Expense is created for the receipt total, and the receipt flips to
 * CONFIRMED. If any step throws, nothing is applied — inventory can never
 * half-update.
 *
 * Statement count is kept low on purpose: a 20-item batch of individual
 * creates blew the interactive-transaction timeout over Neon's pooled
 * connection in Phase 2 (P2028), so reads happen up front and writes are
 * batched, with an explicit timeout as a second line of defence.
 */
export async function confirmReceipt(
  userId: string,
  id: string,
): Promise<ConfirmResult> {
  const receipt = await prisma.receipt.findFirst({
    where: { id, userId },
    include: { items: true },
  });
  if (!receipt) return { ok: false, reason: "NOT_FOUND" };
  if (receipt.status !== "DRAFT") return { ok: false, reason: "NOT_DRAFT" };
  if (receipt.items.length === 0) return { ok: false, reason: "EMPTY" };

  // An edited total wins; otherwise fall back to the sum of the lines.
  const amount =
    receipt.total !== null
      ? Number(receipt.total.toString())
      : receipt.items.reduce((sum, i) => sum + Number(i.price.toString()), 0);

  const existingProducts = await prisma.product.findMany({
    where: { userId },
    select: { id: true, name: true, quantity: true, status: true },
  });
  const byName = new Map(
    existingProducts.map((p) => [normalizeName(p.name), p]),
  );

  const toCreate: {
    userId: string;
    name: string;
    category: string;
    status: "IN_STOCK";
    quantity: number;
    unit: string;
  }[] = [];
  const toUpdate: { id: string; quantity: number }[] = [];

  for (const item of receipt.items) {
    const match = byName.get(normalizeName(item.name));
    const quantity = Number(item.quantity.toString());
    if (match) {
      // An item already on the shopping list flips to IN_STOCK and its
      // quantity is replaced by what was actually bought.
      toUpdate.push({ id: match.id, quantity });
    } else {
      toCreate.push({
        userId,
        name: item.name,
        category: item.category ?? "Другое",
        status: "IN_STOCK",
        quantity,
        unit: item.unit,
      });
    }
  }

  // Matched items all become IN_STOCK; only the quantity differs. Grouping by
  // quantity turns one statement per item into one per distinct value — a real
  // receipt clusters heavily around 1 and 2, so this is usually 2–3 statements
  // instead of thirty, and the transaction no longer lengthens with the basket.
  const idsByQuantity = new Map<number, string[]>();
  for (const update of toUpdate) {
    const ids = idsByQuantity.get(update.quantity) ?? [];
    ids.push(update.id);
    idsByQuantity.set(update.quantity, ids);
  }

  try {
    await prisma.$transaction(
      async (tx) => {
        // Claim the receipt FIRST, conditional on it still being a draft.
        // This is the concurrency guard: two simultaneous confirms both pass
        // the read-side check above, but only one can match this WHERE — the
        // loser matches zero rows and aborts before any money is written.
        const claimed = await tx.receipt.updateMany({
          where: { id: receipt.id, userId, status: "DRAFT" },
          data: { status: "CONFIRMED", total: amount },
        });
        if (claimed.count === 0) throw new AlreadyConfirmedError();

        if (toCreate.length > 0) {
          await tx.product.createMany({ data: toCreate });
        }
        for (const [quantity, ids] of idsByQuantity) {
          await tx.product.updateMany({
            where: { id: { in: ids } },
            data: { status: "IN_STOCK", quantity },
          });
        }
        await tx.expense.create({
          data: {
            userId,
            date: receipt.purchasedAt ?? new Date(),
            category: EXPENSE_CATEGORY,
            amount,
            note: receipt.store,
            receiptId: receipt.id,
          },
        });
      },
      { timeout: 20_000, maxWait: 10_000 },
    );
  } catch (error) {
    // Losing the race is an expected outcome, not a failure to report.
    if (error instanceof AlreadyConfirmedError) {
      return { ok: false, reason: "NOT_DRAFT" };
    }
    throw error;
  }

  return {
    ok: true,
    merged: toUpdate.length,
    created: toCreate.length,
    amount,
  };
}

/** Discard a draft. Cascades remove its items; a confirmed receipt is kept. */
export async function discardReceipt(
  userId: string,
  id: string,
): Promise<boolean | "NOT_DRAFT"> {
  const existing = await prisma.receipt.findFirst({
    where: { id, userId },
    select: { status: true },
  });
  if (!existing) return false;
  if (existing.status !== "DRAFT") return "NOT_DRAFT";

  await prisma.receipt.delete({ where: { id } });
  return true;
}
