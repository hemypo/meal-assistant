import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = { recipe: { deleteMany: vi.fn() } };
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

const { cleanupOrphanRecipes, ORPHAN_RECIPE_TTL_DAYS } = await import(
  "./cleanup"
);

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.recipe.deleteMany.mockResolvedValue({ count: 0 });
});

describe("orphan AI recipe cleanup", () => {
  it("only ever deletes unsaved, unscheduled AI recipes", async () => {
    await cleanupOrphanRecipes(new Date("2026-08-03T00:00:00.000Z"));

    const { where } = prismaMock.recipe.deleteMany.mock.calls[0][0];
    expect(where.source).toBe("AI");
    expect(where.isSaved).toBe(false);
    expect(where.mealEntries).toEqual({ none: {} });
  });

  it("uses a cutoff exactly TTL days back", async () => {
    const now = new Date("2026-08-03T00:00:00.000Z");
    await cleanupOrphanRecipes(now);

    const { where } = prismaMock.recipe.deleteMany.mock.calls[0][0];
    const expected = new Date(
      now.getTime() - ORPHAN_RECIPE_TTL_DAYS * 86_400_000,
    );
    expect(where.createdAt.lt.toISOString()).toBe(expected.toISOString());
    expect(where.createdAt.lt.toISOString()).toBe("2026-07-27T00:00:00.000Z");
  });

  it("never targets manual recipes — the user wrote those", async () => {
    await cleanupOrphanRecipes();

    const { where } = prismaMock.recipe.deleteMany.mock.calls[0][0];
    expect(where.source).not.toBe("MANUAL");
    expect(where.source).toBe("AI");
  });

  it("reports how many were removed", async () => {
    prismaMock.recipe.deleteMany.mockResolvedValue({ count: 4 });

    await expect(cleanupOrphanRecipes()).resolves.toBe(4);
  });
});
