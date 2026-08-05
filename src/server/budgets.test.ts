import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  budget: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    upsert: vi.fn(),
    deleteMany: vi.fn(),
  },
  product: { findMany: vi.fn() },
  mealPlanEntry: { count: vi.fn() },
};
const getSummary = vi.fn();

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/server/analytics", () => ({
  getSummary: (...a: unknown[]) => getSummary(...a),
}));

const {
  monthBounds,
  listBudgets,
  getForecast,
  getShoppingEstimate,
  getMealCost,
} = await import("./budgets");

const dec = (n: number) => ({ toString: () => String(n) });

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.budget.findFirst.mockResolvedValue(null);
  getSummary.mockResolvedValue({
    total: 0,
    count: 0,
    byCategory: [],
    trend: [],
  });
});

describe("monthBounds", () => {
  it("covers the whole month", () => {
    expect(monthBounds("2026-08")).toEqual({
      from: "2026-08-01",
      to: "2026-08-31",
      days: 31,
    });
  });

  it("handles a 30-day month and February", () => {
    expect(monthBounds("2026-04").to).toBe("2026-04-30");
    expect(monthBounds("2026-02").days).toBe(28);
  });

  it("handles a leap February", () => {
    expect(monthBounds("2028-02").days).toBe(29);
  });
});

describe("budget progress", () => {
  it("measures the overall budget against the month total", async () => {
    prismaMock.budget.findMany.mockResolvedValue([
      { category: "", limitAmount: dec(20000) },
    ]);
    getSummary.mockResolvedValue({
      total: 15000,
      count: 3,
      byCategory: [{ category: "Продукты", amount: 15000, share: 100 }],
      trend: [],
    });

    const [overall] = await listBudgets("u1", "2026-08");

    expect(overall).toMatchObject({
      spent: 15000,
      usedPct: 75,
      remaining: 5000,
      overspent: false,
    });
  });

  it("measures a category budget against that category only", async () => {
    prismaMock.budget.findMany.mockResolvedValue([
      { category: "Бытовое", limitAmount: dec(1000) },
    ]);
    getSummary.mockResolvedValue({
      total: 15000,
      count: 5,
      byCategory: [
        { category: "Продукты", amount: 14000, share: 93.33 },
        { category: "Бытовое", amount: 1000, share: 6.67 },
      ],
      trend: [],
    });

    const [household] = await listBudgets("u1", "2026-08");

    expect(household.spent).toBe(1000);
    expect(household.usedPct).toBe(100);
  });

  it("reports an over-run instead of pinning at 100%", async () => {
    prismaMock.budget.findMany.mockResolvedValue([
      { category: "", limitAmount: dec(10000) },
    ]);
    getSummary.mockResolvedValue({
      total: 12500,
      count: 4,
      byCategory: [],
      trend: [],
    });

    const [overall] = await listBudgets("u1", "2026-08");

    expect(overall.overspent).toBe(true);
    expect(overall.usedPct).toBe(125);
    expect(overall.remaining).toBe(-2500);
  });

  it("does not divide by a zero limit", async () => {
    prismaMock.budget.findMany.mockResolvedValue([
      { category: "", limitAmount: dec(0) },
    ]);
    getSummary.mockResolvedValue({
      total: 500,
      count: 1,
      byCategory: [],
      trend: [],
    });

    const [overall] = await listBudgets("u1", "2026-08");

    expect(Number.isFinite(overall.usedPct)).toBe(true);
    expect(overall.usedPct).toBe(0);
  });

  it("scopes the query to the caller and month", async () => {
    prismaMock.budget.findMany.mockResolvedValue([]);

    await listBudgets("u1", "2026-08");

    expect(prismaMock.budget.findMany).toHaveBeenCalledWith({
      where: { userId: "u1", month: "2026-08" },
    });
  });
});

describe("forecast", () => {
  it("projects month-end from the rate so far", async () => {
    // 6000 over 10 days of a 31-day month -> 600/day -> 18600.
    getSummary.mockResolvedValue({
      total: 6000,
      count: 8,
      byCategory: [],
      trend: [],
    });

    const forecast = await getForecast(
      "u1",
      "2026-08",
      new Date("2026-08-10T12:00:00.000Z"),
    );

    expect(forecast.daysElapsed).toBe(10);
    expect(forecast.dailyAverage).toBe(600);
    expect(forecast.projected).toBe(18600);
  });

  it("flags a projected over-run against the overall limit", async () => {
    getSummary.mockResolvedValue({
      total: 6000,
      count: 8,
      byCategory: [],
      trend: [],
    });
    prismaMock.budget.findFirst.mockResolvedValue({ limitAmount: dec(15000) });

    const forecast = await getForecast(
      "u1",
      "2026-08",
      new Date("2026-08-10T12:00:00.000Z"),
    );

    // 18600 projected against a 15000 limit — visible on day 10, not day 31.
    expect(forecast.projectedOverrun).toBe(3600);
  });

  it("treats a past month as complete rather than extrapolating", async () => {
    getSummary.mockResolvedValue({
      total: 9000,
      count: 12,
      byCategory: [],
      trend: [],
    });

    const forecast = await getForecast(
      "u1",
      "2026-07",
      new Date("2026-08-10T12:00:00.000Z"),
    );

    expect(forecast.daysElapsed).toBe(31);
    expect(forecast.projected).toBe(9000);
  });
});

describe("shopping estimate", () => {
  it("sums only items that carry a price", async () => {
    prismaMock.product.findMany.mockResolvedValue([
      { estPrice: dec(120), quantity: dec(1) },
      { estPrice: dec(80.5), quantity: dec(2) },
      { estPrice: null, quantity: dec(1) },
    ]);

    await expect(getShoppingEstimate("u1")).resolves.toEqual({
      itemCount: 3,
      pricedCount: 2,
      estimatedTotal: 200.5,
    });
  });
});

describe("cost per planned meal", () => {
  it("divides grocery spend by meals actually planned", async () => {
    getSummary.mockResolvedValue({
      total: 12000,
      count: 6,
      byCategory: [
        { category: "Продукты", amount: 9000, share: 75 },
        { category: "Бытовое", amount: 3000, share: 25 },
      ],
      trend: [],
    });
    prismaMock.mealPlanEntry.count.mockResolvedValue(30);

    // Groceries only — household spend is not part of a meal's cost.
    await expect(getMealCost("u1", "2026-08")).resolves.toEqual({
      plannedMeals: 30,
      groceriesSpent: 9000,
      averagePerMeal: 300,
    });
  });

  it("returns null rather than dividing by zero meals", async () => {
    getSummary.mockResolvedValue({
      total: 5000,
      count: 2,
      byCategory: [{ category: "Продукты", amount: 5000, share: 100 }],
      trend: [],
    });
    prismaMock.mealPlanEntry.count.mockResolvedValue(0);

    const cost = await getMealCost("u1", "2026-08");

    expect(cost.averagePerMeal).toBeNull();
  });
});
