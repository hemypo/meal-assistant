import { beforeEach, describe, expect, it, vi } from "vitest";

/** Records what the transaction body did, so rollback can be asserted. */
const txCalls: string[] = [];

type Args = { data?: unknown; where?: unknown };

const tx = {
  product: {
    createMany: vi.fn(async (args: Args) => {
      void args;
      txCalls.push("product.createMany");
    }),
    updateMany: vi.fn(async (args: Args) => {
      void args;
      txCalls.push("product.updateMany");
      return { count: 1 };
    }),
  },
  expense: {
    create: vi.fn(async (args: Args) => {
      void args;
      txCalls.push("expense.create");
    }),
  },
  receipt: {
    // The conditional claim that opens the transaction (Stage 1).
    updateMany: vi.fn(async (args: Args) => {
      void args;
      txCalls.push("receipt.claim");
      return { count: 1 };
    }),
  },
};

const prismaMock = {
  receipt: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  product: { findMany: vi.fn() },
  $transaction: vi.fn(
    async (
      fn: (t: typeof tx) => Promise<void>,
      options?: { timeout?: number; maxWait?: number },
    ) => {
      void options;
      return fn(tx);
    },
  ),
};

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/ai/tasks", () => ({ runTask: vi.fn() }));
vi.mock("@/server/categories", async () => ({
  normalizeName: (s: string) => s.trim().toLowerCase().replace(/\s+/g, " "),
  resolveCategories: vi.fn(async () => new Map()),
}));

const { confirmReceipt, discardReceipt } = await import("./receipts");

const draft = {
  id: "rc1",
  status: "DRAFT" as const,
  source: "PHOTO" as const,
  store: "Пятёрочка",
  purchasedAt: new Date("2026-08-02T00:00:00.000Z"),
  total: { toString: () => "526.80" },
  imageUrl: null,
  createdAt: new Date(),
  items: [
    { id: "i1", name: "Молоко", category: "Молочное", quantity: { toString: () => "1" }, unit: "шт", price: { toString: () => "89.90" } },
    { id: "i2", name: "Хлеб Бородинский", category: "Бакалея", quantity: { toString: () => "2" }, unit: "шт", price: { toString: () => "91.00" } },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  txCalls.length = 0;
  prismaMock.$transaction.mockImplementation(async (fn: (t: typeof tx) => Promise<void>) => fn(tx));
});

describe("confirm guards", () => {
  it("rejects a receipt belonging to someone else", async () => {
    prismaMock.receipt.findFirst.mockResolvedValue(null);

    await expect(confirmReceipt("user-b", "rc1")).resolves.toEqual({
      ok: false,
      reason: "NOT_FOUND",
    });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("refuses to confirm the same receipt twice", async () => {
    prismaMock.receipt.findFirst.mockResolvedValue({
      ...draft,
      status: "CONFIRMED",
    });

    await expect(confirmReceipt("user-a", "rc1")).resolves.toEqual({
      ok: false,
      reason: "NOT_DRAFT",
    });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("refuses an empty draft (MASTER.md empty-draft state)", async () => {
    prismaMock.receipt.findFirst.mockResolvedValue({ ...draft, items: [] });

    await expect(confirmReceipt("user-a", "rc1")).resolves.toEqual({
      ok: false,
      reason: "EMPTY",
    });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});

describe("merge by normalised name", () => {
  it("creates products that do not exist yet", async () => {
    prismaMock.receipt.findFirst.mockResolvedValue(draft);
    prismaMock.product.findMany.mockResolvedValue([]);

    const result = await confirmReceipt("user-a", "rc1");

    expect(result).toMatchObject({ ok: true, created: 2, merged: 0 });
    const data = tx.product.createMany.mock.calls[0][0].data as Record<
      string,
      unknown
    >[];
    expect(data).toHaveLength(2);
    expect(data[0]).toMatchObject({ status: "IN_STOCK", userId: "user-a" });
  });

  it("flips an existing TO_BUY item to IN_STOCK instead of duplicating it", async () => {
    prismaMock.receipt.findFirst.mockResolvedValue(draft);
    prismaMock.product.findMany.mockResolvedValue([
      { id: "p1", name: "  МОЛОКО ", quantity: 1, status: "TO_BUY" },
    ]);

    const result = await confirmReceipt("user-a", "rc1");

    expect(result).toMatchObject({ ok: true, merged: 1, created: 1 });
    // Batched by quantity since Stage 1 — the behaviour (that product flips to
    // IN_STOCK with the purchased quantity) is unchanged.
    expect(tx.product.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["p1"] } },
      data: { status: "IN_STOCK", quantity: 1 },
    });
  });
});

describe("expense creation", () => {
  it("uses the receipt total, not the sum of lines", async () => {
    // Lines sum to 180.90 but the receipt total is 526.80 — the total wins,
    // because deleted junk lines must not shrink what was actually paid.
    prismaMock.receipt.findFirst.mockResolvedValue(draft);
    prismaMock.product.findMany.mockResolvedValue([]);

    const result = await confirmReceipt("user-a", "rc1");

    expect(result).toMatchObject({ amount: 526.8 });
    expect(tx.expense.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        amount: 526.8,
        category: "Продукты",
        receiptId: "rc1",
        note: "Пятёрочка",
      }),
    });
  });

  it("falls back to the line sum when no total was parsed", async () => {
    prismaMock.receipt.findFirst.mockResolvedValue({ ...draft, total: null });
    prismaMock.product.findMany.mockResolvedValue([]);

    const result = await confirmReceipt("user-a", "rc1");

    expect(result).toMatchObject({ amount: 180.9 });
  });
});

describe("atomicity", () => {
  it("does all four writes inside ONE transaction", async () => {
    prismaMock.receipt.findFirst.mockResolvedValue(draft);
    prismaMock.product.findMany.mockResolvedValue([
      { id: "p1", name: "Молоко", quantity: 1, status: "TO_BUY" },
    ]);

    await confirmReceipt("user-a", "rc1");

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    // The claim now leads: nothing is written until the receipt is ours.
    expect(txCalls).toEqual([
      "receipt.claim",
      "product.createMany",
      "product.updateMany",
      "expense.create",
    ]);
  });

  it("passes an explicit timeout — the P2028 lesson from Phase 2", async () => {
    prismaMock.receipt.findFirst.mockResolvedValue(draft);
    prismaMock.product.findMany.mockResolvedValue([]);

    await confirmReceipt("user-a", "rc1");

    const options = prismaMock.$transaction.mock.calls[0][1];
    expect(options?.timeout).toBeGreaterThanOrEqual(10_000);
  });

  it("propagates a failure so nothing is applied", async () => {
    prismaMock.receipt.findFirst.mockResolvedValue(draft);
    prismaMock.product.findMany.mockResolvedValue([]);
    prismaMock.$transaction.mockRejectedValue(new Error("db exploded"));

    await expect(confirmReceipt("user-a", "rc1")).rejects.toThrow("db exploded");
    // The receipt must NOT have been flipped outside the transaction.
    expect(prismaMock.receipt.update).not.toHaveBeenCalled();
  });

  it("never marks the receipt confirmed outside the transaction", async () => {
    prismaMock.receipt.findFirst.mockResolvedValue(draft);
    prismaMock.product.findMany.mockResolvedValue([]);

    await confirmReceipt("user-a", "rc1");

    expect(prismaMock.receipt.update).not.toHaveBeenCalled();
    // Confirmed via the in-transaction claim, guarded on it still being DRAFT.
    expect(tx.receipt.updateMany).toHaveBeenCalledWith({
      where: { id: "rc1", userId: "user-a", status: "DRAFT" },
      data: { status: "CONFIRMED", total: 526.8 },
    });
  });
});

describe("discard leaves zero traces", () => {
  it("deletes a draft (items cascade)", async () => {
    prismaMock.receipt.findFirst.mockResolvedValue({ status: "DRAFT" });

    await expect(discardReceipt("user-a", "rc1")).resolves.toBe(true);
    expect(prismaMock.receipt.delete).toHaveBeenCalledWith({
      where: { id: "rc1" },
    });
  });

  it("refuses to delete a confirmed receipt", async () => {
    prismaMock.receipt.findFirst.mockResolvedValue({ status: "CONFIRMED" });

    await expect(discardReceipt("user-a", "rc1")).resolves.toBe("NOT_DRAFT");
    expect(prismaMock.receipt.delete).not.toHaveBeenCalled();
  });

  it("returns false for another user's receipt", async () => {
    prismaMock.receipt.findFirst.mockResolvedValue(null);

    await expect(discardReceipt("user-b", "rc1")).resolves.toBe(false);
    expect(prismaMock.receipt.delete).not.toHaveBeenCalled();
  });
});
