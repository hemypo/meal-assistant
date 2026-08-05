import { beforeEach, describe, expect, it, vi } from "vitest";

const runTask = vi.fn();
const getSummary = vi.fn();
const getForecast = vi.fn();
const listBudgets = vi.fn();

vi.mock("@/lib/ai/tasks", () => ({ runTask: (...a: unknown[]) => runTask(...a) }));
vi.mock("@/server/analytics", () => ({
  getSummary: (...a: unknown[]) => getSummary(...a),
}));
vi.mock("@/server/budgets", () => ({
  getForecast: (...a: unknown[]) => getForecast(...a),
  listBudgets: (...a: unknown[]) => listBudgets(...a),
  monthBounds: (m: string) => ({ from: `${m}-01`, to: `${m}-31`, days: 31 }),
}));

const { buildSpendingReview } = await import("./review");

const aug = {
  total: 15000,
  count: 9,
  byCategory: [
    { category: "Продукты", amount: 12000, share: 80 },
    { category: "Бытовое", amount: 3000, share: 20 },
  ],
  trend: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  getForecast.mockResolvedValue({ projected: 18000 });
  listBudgets.mockResolvedValue([]);
  runTask.mockResolvedValue({
    summary: "Основные траты — продукты.",
    observations: ["Продукты составили 80% расходов."],
    suggestions: ["Планируйте покупки по списку."],
  });
});

describe("the model only ever interprets computed figures", () => {
  it("passes the real totals in and returns them unchanged", async () => {
    getSummary.mockResolvedValueOnce(aug).mockResolvedValueOnce({
      total: 11000,
      count: 7,
      byCategory: [],
      trend: [],
    });

    const review = await buildSpendingReview("u1", "2026-08");

    // Accept criterion: what the UI shows equals what analytics computed.
    expect(review.figures).toEqual({
      total: 15000,
      previousTotal: 11000,
      projected: 18000,
      byCategory: aug.byCategory,
    });

    const [task, payload] = runTask.mock.calls[0];
    expect(task).toBe("review_spending");
    expect(payload.total).toBe(15000);
    expect(payload.projected).toBe(18000);
  });

  it("never sends raw receipts or expense rows to the model", async () => {
    getSummary.mockResolvedValue(aug);

    await buildSpendingReview("u1", "2026-08");

    const payload = JSON.stringify(runTask.mock.calls[0][1]);
    expect(payload).not.toMatch(/receipt/i);
    expect(payload).not.toMatch(/note/i);
    // Only aggregates: totals, categories, budgets.
    expect(Object.keys(runTask.mock.calls[0][1]).sort()).toEqual([
      "budgets",
      "categories",
      "month",
      "previousTotal",
      "projected",
      "total",
    ]);
  });

  it("distinguishes 'no data last month' from 'spent nothing'", async () => {
    getSummary.mockResolvedValueOnce(aug).mockResolvedValueOnce({
      total: 0,
      count: 0,
      byCategory: [],
      trend: [],
    });

    const review = await buildSpendingReview("u1", "2026-08");

    expect(review.figures.previousTotal).toBeNull();
  });

  it("rolls the previous month back over a year boundary", async () => {
    getSummary.mockResolvedValue(aug);

    await buildSpendingReview("u1", "2026-01");

    // Second getSummary call is the previous month.
    const previousRange = getSummary.mock.calls[1][1];
    expect(previousRange.from).toBe("2025-12-01");
  });
});
