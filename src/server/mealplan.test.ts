import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  mealPlanEntry: { findMany: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
  recipe: { findFirst: vi.fn() },
};

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

const { listMealPlan, addMealEntry, deleteMealEntry, toIsoDate, fromIsoDate } =
  await import("./mealplan");

const recipe = {
  id: "r1",
  title: "Курица",
  steps: ["Готовить"],
  calories: 500,
  proteinG: 40,
  fatG: 20,
  carbsG: 30,
  cookTimeMin: 30,
  source: "AI" as const,
  isSaved: false,
  ingredients: [],
};

beforeEach(() => vi.clearAllMocks());

describe("date handling (@db.Date is UTC midnight)", () => {
  it("round-trips an ISO date without drifting a day", () => {
    expect(toIsoDate(fromIsoDate("2026-08-03"))).toBe("2026-08-03");
  });

  it("parses to UTC midnight, not local midnight", () => {
    expect(fromIsoDate("2026-08-03").toISOString()).toBe(
      "2026-08-03T00:00:00.000Z",
    );
  });

  it("queries an inclusive date range", async () => {
    prismaMock.mealPlanEntry.findMany.mockResolvedValue([]);
    await listMealPlan("user-a", "2026-08-03", "2026-08-09");

    expect(prismaMock.mealPlanEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: "user-a",
          date: {
            gte: new Date("2026-08-03T00:00:00.000Z"),
            lte: new Date("2026-08-09T00:00:00.000Z"),
          },
        },
      }),
    );
  });
});

describe("userId scoping", () => {
  it("refuses to schedule another user's recipe", async () => {
    prismaMock.recipe.findFirst.mockResolvedValue(null);

    const result = await addMealEntry("user-b", {
      date: "2026-08-03",
      mealType: "DINNER",
      recipeId: "r1",
    });

    expect(result).toBeNull();
    expect(prismaMock.mealPlanEntry.upsert).not.toHaveBeenCalled();
  });

  it("looks the recipe up scoped by userId", async () => {
    prismaMock.recipe.findFirst.mockResolvedValue(recipe);
    prismaMock.mealPlanEntry.upsert.mockResolvedValue({
      id: "m1",
      date: new Date("2026-08-03T00:00:00.000Z"),
      mealType: "DINNER",
    });

    await addMealEntry("user-a", {
      date: "2026-08-03",
      mealType: "DINNER",
      recipeId: "r1",
    });

    expect(prismaMock.recipe.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "r1", userId: "user-a" } }),
    );
  });

  it("refuses to delete another user's entry", async () => {
    prismaMock.mealPlanEntry.deleteMany.mockResolvedValue({ count: 0 });

    await expect(deleteMealEntry("user-b", "m1")).resolves.toBe(false);
  });
});

describe("scheduling the same recipe twice", () => {
  it("upserts rather than erroring on the unique constraint", async () => {
    prismaMock.recipe.findFirst.mockResolvedValue(recipe);
    prismaMock.mealPlanEntry.upsert.mockResolvedValue({
      id: "m1",
      date: new Date("2026-08-03T00:00:00.000Z"),
      mealType: "DINNER",
    });

    const entry = await addMealEntry("user-a", {
      date: "2026-08-03",
      mealType: "DINNER",
      recipeId: "r1",
    });

    expect(entry?.date).toBe("2026-08-03");
    expect(prismaMock.mealPlanEntry.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: {} }),
    );
  });
});
