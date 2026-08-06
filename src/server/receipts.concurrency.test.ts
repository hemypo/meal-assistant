import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Stage 1 regression tests.
 *
 * These reproduce two defects found in the architecture review:
 *   1. the DRAFT guard sits OUTSIDE the transaction, so two concurrent
 *      confirms can both pass it and both apply;
 *   2. matched items are updated one statement at a time, so transaction
 *      cost scales with receipt length.
 *
 * The Prisma mock below deliberately models Postgres row semantics: a
 * conditional update only matches while the row still satisfies its WHERE.
 */

/** Shared row state, so a conditional update can actually fail to match. */
let receiptStatus: "DRAFT" | "CONFIRMED";
let expensesCreated: number;
let productUpdateStatements: number;

type Args = {
  data?: Record<string, unknown>;
  where?: Record<string, unknown>;
};

const tx = {
  product: {
    createMany: vi.fn(async (a: Args) => { void a; return { count: 0 }; }),
    // The current implementation calls this once per matched item.
    update: vi.fn(async (a: Args) => {
      void a;
      productUpdateStatements++;
      return {};
    }),
    // The batched implementation should call this instead.
    updateMany: vi.fn(async (a: Args) => {
      void a;
      productUpdateStatements++;
      return { count: 0 };
    }),
  },
  expense: {
    create: vi.fn(async (a: Args) => {
      void a;
      expensesCreated++;
      return {};
    }),
  },
  receipt: {
    update: vi.fn(async (a: Args) => {
      receiptStatus = a.data?.status as "CONFIRMED";
      return {};
    }),
    // Conditional claim: matches only while the row is still DRAFT.
    updateMany: vi.fn(async (a: Args) => {
      const required = a.where?.status;
      if (required && receiptStatus !== required) return { count: 0 };
      receiptStatus = (a.data?.status as "CONFIRMED") ?? receiptStatus;
      return { count: 1 };
    }),
  },
};

const dec = (n: number) => ({ toString: () => String(n) });

const prismaMock = {
  receipt: {
    // Reads the shared state, so both racers observe DRAFT before either commits.
    findFirst: vi.fn(async () => ({
      id: "rc1",
      status: receiptStatus,
      source: "PHOTO" as const,
      store: "Пятёрочка",
      purchasedAt: new Date("2026-08-02T00:00:00.000Z"),
      total: dec(500),
      imageUrl: null,
      createdAt: new Date(),
      items: [
        {
          id: "i1",
          name: "Молоко",
          category: "Молочное",
          quantity: dec(1),
          unit: "шт",
          price: dec(500),
        },
      ],
    })),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  product: {
    findMany: vi.fn(async () => [
      { id: "p1", name: "Молоко", quantity: dec(1), status: "TO_BUY" },
    ]),
  },
  $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<void>) => fn(tx)),
};

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/ai/tasks", () => ({ runTask: vi.fn() }));
vi.mock("@/server/categories", async () => ({
  normalizeName: (s: string) => s.trim().toLowerCase().replace(/\s+/g, " "),
  resolveCategories: vi.fn(async () => new Map()),
}));

const { confirmReceipt } = await import("./receipts");

beforeEach(() => {
  vi.clearAllMocks();
  receiptStatus = "DRAFT";
  expensesCreated = 0;
  productUpdateStatements = 0;
});

describe("concurrent confirm (double-spend guard)", () => {
  it("creates exactly one expense when the same receipt is confirmed twice at once", async () => {
    // Both callers read the receipt while it is still DRAFT — the real race.
    const [a, b] = await Promise.all([
      confirmReceipt("user-a", "rc1").catch((e) => e),
      confirmReceipt("user-a", "rc1").catch((e) => e),
    ]);

    // The money side is what must not double.
    expect(expensesCreated).toBe(1);

    // Exactly one caller should report success.
    const succeeded = [a, b].filter(
      (r) => r && typeof r === "object" && "ok" in r && r.ok === true,
    );
    expect(succeeded).toHaveLength(1);
  });

  it("reports the loser as already-confirmed rather than throwing", async () => {
    const results = await Promise.all([
      confirmReceipt("user-a", "rc1").catch(() => "threw"),
      confirmReceipt("user-a", "rc1").catch(() => "threw"),
    ]);

    expect(results).not.toContain("threw");
    const loser = results.find(
      (r) => typeof r === "object" && r && "ok" in r && r.ok === false,
    );
    expect(loser).toMatchObject({ ok: false, reason: "NOT_DRAFT" });
  });

  it("claims the receipt inside the transaction, not before it", async () => {
    await confirmReceipt("user-a", "rc1");

    // The status flip must be conditional on it still being DRAFT.
    const claim = tx.receipt.updateMany.mock.calls[0]?.[0];
    expect(claim).toBeDefined();
    expect(claim?.where).toMatchObject({ status: "DRAFT" });
  });
});

describe("update statement count does not scale with receipt length", () => {
  it("issues one statement per distinct quantity, not per item", async () => {
    // 30 matched items across only 3 distinct quantities.
    const items = Array.from({ length: 30 }, (_, i) => ({
      id: `i${i}`,
      name: `Товар ${i}`,
      category: "Другое",
      quantity: dec([1, 2, 3][i % 3]),
      unit: "шт",
      price: dec(100),
    }));
    const products = items.map((item, i) => ({
      id: `p${i}`,
      name: item.name,
      quantity: dec(1),
      status: "TO_BUY",
    }));

    prismaMock.receipt.findFirst.mockResolvedValueOnce({
      id: "rc1",
      status: "DRAFT",
      source: "PHOTO",
      store: "Магнит",
      purchasedAt: new Date("2026-08-02T00:00:00.000Z"),
      total: dec(3000),
      imageUrl: null,
      createdAt: new Date(),
      items,
    } as never);
    prismaMock.product.findMany.mockResolvedValueOnce(products as never);

    await confirmReceipt("user-a", "rc1");

    // 30 items, 3 distinct quantities -> at most 3 statements, never 30.
    expect(productUpdateStatements).toBeLessThanOrEqual(3);
  });
});
