import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  expense: {
    findMany: vi.fn(),
    create: vi.fn(),
    deleteMany: vi.fn(),
  },
};

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

const { getSummary, listExpenses, deleteExpense } = await import("./analytics");

/** Decimal columns arrive as objects with toString(), not numbers. */
const dec = (value: string) => ({ toString: () => value });
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

const range = { from: "2026-08-01", to: "2026-08-31" };

beforeEach(() => vi.clearAllMocks());

describe("summary arithmetic (the acceptance criterion)", () => {
  it("totals match a hand-checked sum of the rows", async () => {
    prismaMock.expense.findMany.mockResolvedValue([
      { date: day("2026-08-01"), category: "Продукты", amount: dec("849.90") },
      { date: day("2026-08-02"), category: "Продукты", amount: dec("195.90") },
      { date: day("2026-08-02"), category: "Бытовое", amount: dec("310.00") },
      { date: day("2026-08-05"), category: "Здоровье", amount: dec("1200.50") },
    ]);

    const summary = await getSummary("u1", range);

    // 849.90 + 195.90 + 310.00 + 1200.50 = 2556.30
    expect(summary.total).toBe(2556.3);
    expect(summary.count).toBe(4);
  });

  it("computes category shares and orders them by amount", async () => {
    prismaMock.expense.findMany.mockResolvedValue([
      { date: day("2026-08-01"), category: "Продукты", amount: dec("750") },
      { date: day("2026-08-02"), category: "Бытовое", amount: dec("250") },
    ]);

    const { byCategory } = await getSummary("u1", range);

    expect(byCategory).toEqual([
      { category: "Продукты", amount: 750, share: 75 },
      { category: "Бытовое", amount: 250, share: 25 },
    ]);
  });

  it("shares land within a cent of 100% — they are rounded independently", async () => {
    // Real data: 1299.70 / 1200 / 200.20 of 2699.90 rounds to
    // 48.14 + 44.45 + 7.42 = 100.01. The donut is drawn from `amount`, so the
    // slices are exact; `share` is a display value and may drift a hair.
    // Asserting an exact 100 here would only pass for numbers that divide evenly.
    prismaMock.expense.findMany.mockResolvedValue([
      { date: day("2026-08-01"), category: "Продукты", amount: dec("1299.70") },
      { date: day("2026-08-02"), category: "Здоровье", amount: dec("1200") },
      { date: day("2026-08-03"), category: "Бытовое", amount: dec("200.20") },
    ]);

    const { byCategory, total } = await getSummary("u1", range);

    expect(total).toBe(2699.9);
    const shareSum = byCategory.reduce((s, c) => s + c.share, 0);
    expect(Math.abs(shareSum - 100)).toBeLessThanOrEqual(0.05);
    // Amounts, which actually drive the chart, stay exact — though re-adding
    // them needs the same rounding the service applies, since
    // 1299.7 + 1200 + 200.2 is 2699.8999999999996 in raw float maths.
    const rejoined = byCategory.reduce((s, c) => s + c.amount, 0);
    expect(Math.round(rejoined * 100) / 100).toBe(2699.9);
  });

  it("merges several expenses on the same day into one trend bucket", async () => {
    prismaMock.expense.findMany.mockResolvedValue([
      { date: day("2026-08-02"), category: "Продукты", amount: dec("100.10") },
      { date: day("2026-08-02"), category: "Бытовое", amount: dec("200.20") },
      { date: day("2026-08-01"), category: "Продукты", amount: dec("50") },
    ]);

    const { trend } = await getSummary("u1", range);

    expect(trend).toEqual([
      { date: "2026-08-01", amount: 50 },
      { date: "2026-08-02", amount: 300.3 },
    ]);
  });

  it("keeps float arithmetic from leaking cents into the total", async () => {
    // 0.1 + 0.2 = 0.30000000000000004 in raw float maths.
    prismaMock.expense.findMany.mockResolvedValue([
      { date: day("2026-08-01"), category: "Продукты", amount: dec("0.1") },
      { date: day("2026-08-01"), category: "Продукты", amount: dec("0.2") },
    ]);

    const summary = await getSummary("u1", range);

    expect(summary.total).toBe(0.3);
    expect(summary.trend[0].amount).toBe(0.3);
  });

  it("returns zeroes rather than NaN for an empty range", async () => {
    prismaMock.expense.findMany.mockResolvedValue([]);

    const summary = await getSummary("u1", range);

    expect(summary).toEqual({ total: 0, count: 0, byCategory: [], trend: [] });
  });
});

describe("userId scoping", () => {
  it("scopes the summary query to the caller and the range", async () => {
    prismaMock.expense.findMany.mockResolvedValue([]);

    await getSummary("u1", range);

    const where = prismaMock.expense.findMany.mock.calls[0][0].where;
    expect(where.userId).toBe("u1");
    expect(where.date.gte).toEqual(day("2026-08-01"));
    expect(where.date.lte).toEqual(day("2026-08-31"));
  });

  it("scopes listExpenses to the caller", async () => {
    prismaMock.expense.findMany.mockResolvedValue([]);

    await listExpenses("u1", range);

    expect(prismaMock.expense.findMany.mock.calls[0][0].where.userId).toBe("u1");
  });

  it("refuses to delete another user's expense", async () => {
    prismaMock.expense.deleteMany.mockResolvedValue({ count: 0 });

    await expect(deleteExpense("u2", "e1")).resolves.toBe(false);
    expect(prismaMock.expense.deleteMany).toHaveBeenCalledWith({
      where: { id: "e1", userId: "u2" },
    });
  });
});
