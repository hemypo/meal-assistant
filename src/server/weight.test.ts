import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  weightEntry: { findMany: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
  user: { findUnique: vi.fn() },
  mealPlanEntry: { findMany: vi.fn() },
};

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

const { upsertWeight, deleteWeight, getWeightOverview } = await import(
  "./weight"
);

const dec = (v: string) => ({ toString: () => v });
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const range = { from: "2026-08-01", to: "2026-08-07" };

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.user.findUnique.mockResolvedValue({ weightGoalKg: dec("76.0") });
  prismaMock.mealPlanEntry.findMany.mockResolvedValue([]);
  prismaMock.weightEntry.findMany.mockResolvedValue([]);
});

describe("one entry per day", () => {
  it("upserts on the composite key rather than appending a duplicate", async () => {
    prismaMock.weightEntry.upsert.mockResolvedValue({
      date: day("2026-08-02"),
      weightKg: dec("78.4"),
    });

    const result = await upsertWeight("u1", {
      date: "2026-08-02",
      weightKg: 78.4,
    });

    expect(prismaMock.weightEntry.upsert).toHaveBeenCalledWith({
      where: { userId_date: { userId: "u1", date: day("2026-08-02") } },
      create: { userId: "u1", date: day("2026-08-02"), weightKg: 78.4 },
      update: { weightKg: 78.4 },
    });
    expect(result).toEqual({ date: "2026-08-02", weightKg: 78.4 });
  });

  it("refuses to delete another user's entry", async () => {
    prismaMock.weightEntry.deleteMany.mockResolvedValue({ count: 0 });

    await expect(deleteWeight("u2", "2026-08-02")).resolves.toBe(false);
    expect(prismaMock.weightEntry.deleteMany).toHaveBeenCalledWith({
      where: { userId: "u2", date: day("2026-08-02") },
    });
  });
});

describe("progress toward the goal", () => {
  it("reports the distance from the latest weight to the goal", async () => {
    prismaMock.weightEntry.findMany.mockResolvedValue([
      { date: day("2026-08-01"), weightKg: dec("80.0") },
      { date: day("2026-08-05"), weightKg: dec("78.4") },
    ]);

    const overview = await getWeightOverview("u1", range);

    expect(overview.latestKg).toBe(78.4);
    expect(overview.goalKg).toBe(76);
    expect(overview.toGoalKg).toBe(2.4);
  });

  it("goes negative once the goal is passed, rather than clamping", async () => {
    prismaMock.weightEntry.findMany.mockResolvedValue([
      { date: day("2026-08-05"), weightKg: dec("74.5") },
    ]);

    const overview = await getWeightOverview("u1", range);

    expect(overview.toGoalKg).toBe(-1.5);
  });

  it("returns nulls instead of guessing when there are no entries", async () => {
    const overview = await getWeightOverview("u1", range);

    expect(overview.latestKg).toBeNull();
    expect(overview.toGoalKg).toBeNull();
    expect(overview.entries).toEqual([]);
  });
});

describe("average daily КБЖУ", () => {
  it("averages over days that have meals, not every day in range", async () => {
    // Two planned days totalling 2400 kcal across a seven-day range.
    prismaMock.mealPlanEntry.findMany.mockResolvedValue([
      { date: day("2026-08-01"), recipe: { calories: 800 } },
      { date: day("2026-08-01"), recipe: { calories: 400 } },
      { date: day("2026-08-03"), recipe: { calories: 1200 } },
    ]);

    const overview = await getWeightOverview("u1", range);

    // (1200 + 1200) / 2 planned days = 1200, not 2400/7.
    expect(overview.avgKcal).toBe(1200);
  });

  it("ignores recipes with no calorie data", async () => {
    prismaMock.mealPlanEntry.findMany.mockResolvedValue([
      { date: day("2026-08-01"), recipe: { calories: 500 } },
      { date: day("2026-08-02"), recipe: { calories: null } },
    ]);

    const overview = await getWeightOverview("u1", range);

    expect(overview.avgKcal).toBe(500);
  });

  it("is null when nothing is planned", async () => {
    const overview = await getWeightOverview("u1", range);

    expect(overview.avgKcal).toBeNull();
  });
});
