import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  recipe: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  product: { findMany: vi.fn(), createMany: vi.fn() },
  user: { findUnique: vi.fn() },
};
const runTask = vi.fn();

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/ai/tasks", () => ({ runTask: (...a: unknown[]) => runTask(...a) }));

const { listRecipes, updateRecipe, deleteRecipe, missingToShopping, generateRecipe } =
  await import("./recipes");

const recipeRow = {
  id: "r1",
  title: "Курица с гречкой",
  steps: ["Отварить гречку", "Обжарить курицу"],
  calories: 520,
  proteinG: 45,
  fatG: 14,
  carbsG: 50,
  cookTimeMin: 35,
  source: "AI" as const,
  isSaved: false,
  ingredients: [
    { id: "i1", name: "Куриное филе", amount: "300", unit: "г", wasInStock: true, estPrice: null },
    { id: "i2", name: "Гречка", amount: "150", unit: "г", wasInStock: true, estPrice: null },
    { id: "i3", name: "Соевый соус", amount: "30", unit: "мл", wasInStock: false, estPrice: "80" },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.product.createMany.mockResolvedValue({ count: 0 });
  prismaMock.user.findUnique.mockResolvedValue({ kcalTarget: 2400 });
});

describe("userId scoping", () => {
  it("lists only the caller's recipes", async () => {
    prismaMock.recipe.findMany.mockResolvedValue([]);
    await listRecipes("user-a", true);

    expect(prismaMock.recipe.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-a", isSaved: true } }),
    );
  });

  it("returns null when updating another user's recipe", async () => {
    prismaMock.recipe.updateMany.mockResolvedValue({ count: 0 });

    await expect(updateRecipe("user-b", "r1", { isSaved: true })).resolves.toBeNull();
    expect(prismaMock.recipe.findFirst).not.toHaveBeenCalled();
  });

  it("refuses to delete another user's recipe", async () => {
    prismaMock.recipe.deleteMany.mockResolvedValue({ count: 0 });

    await expect(deleteRecipe("user-b", "r1")).resolves.toBe(false);
    expect(prismaMock.recipe.deleteMany).toHaveBeenCalledWith({
      where: { id: "r1", userId: "user-b" },
    });
  });
});

describe("Json steps column is never trusted blindly", () => {
  it("survives a non-array steps value", async () => {
    prismaMock.recipe.findMany.mockResolvedValue([
      { ...recipeRow, steps: "not an array" },
    ]);

    const [recipe] = await listRecipes("user-a", false);
    expect(recipe.steps).toEqual([]);
  });

  it("drops non-string entries", async () => {
    prismaMock.recipe.findMany.mockResolvedValue([
      { ...recipeRow, steps: ["ok", 42, null, "also ok"] },
    ]);

    const [recipe] = await listRecipes("user-a", false);
    expect(recipe.steps).toEqual(["ok", "also ok"]);
  });
});

describe("missing ingredients -> shopping list (§9.2)", () => {
  it("adds only ingredients flagged not-in-stock", async () => {
    prismaMock.recipe.findFirst.mockResolvedValue(recipeRow);
    prismaMock.product.findMany.mockResolvedValue([]);

    const result = await missingToShopping("user-a", "r1");

    expect(result).toEqual({ added: 1, alreadyListed: 0 });
    const { data } = prismaMock.product.createMany.mock.calls[0][0];
    expect(data).toHaveLength(1);
    expect(data[0]).toMatchObject({
      name: "Соевый соус",
      status: "TO_BUY",
      userId: "user-a",
      estPrice: 80,
    });
  });

  it("does not duplicate a product the user already has", async () => {
    prismaMock.recipe.findFirst.mockResolvedValue(recipeRow);
    prismaMock.product.findMany.mockResolvedValue([{ name: "  СОЕВЫЙ  СОУС " }]);

    const result = await missingToShopping("user-a", "r1");

    expect(result).toEqual({ added: 0, alreadyListed: 1 });
    expect(prismaMock.product.createMany).not.toHaveBeenCalled();
  });

  it("writes nothing when every ingredient is in stock", async () => {
    prismaMock.recipe.findFirst.mockResolvedValue({
      ...recipeRow,
      ingredients: recipeRow.ingredients.filter((i) => i.wasInStock),
    });

    const result = await missingToShopping("user-a", "r1");

    expect(result).toEqual({ added: 0, alreadyListed: 0 });
    expect(prismaMock.product.findMany).not.toHaveBeenCalled();
    expect(prismaMock.product.createMany).not.toHaveBeenCalled();
  });

  it("returns null for another user's recipe", async () => {
    prismaMock.recipe.findFirst.mockResolvedValue(null);

    await expect(missingToShopping("user-b", "r1")).resolves.toBeNull();
  });
});

describe("recipe generation", () => {
  it("sends the caller's in-stock products and stores the result unsaved", async () => {
    prismaMock.product.findMany.mockResolvedValue([
      { name: "Куриное филе", quantity: "1.2", unit: "кг" },
    ]);
    runTask.mockResolvedValue({
      title: "Курица",
      steps: ["Готовить"],
      calories: 500,
      proteinG: 40,
      fatG: 20,
      carbsG: 30,
      cookTimeMin: 30,
      ingredients: [
        { name: "Куриное филе", amount: 300, unit: "г", wasInStock: true },
      ],
    });
    prismaMock.recipe.create.mockResolvedValue({
      ...recipeRow,
      title: "Курица",
      isSaved: false,
    });

    await generateRecipe("user-a", "лёгкий ужин");

    expect(prismaMock.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-a", status: "IN_STOCK" } }),
    );
    expect(runTask).toHaveBeenCalledWith("generate_recipe", {
      inStock: ["Куриное филе 1.2 кг"],
      wishes: "лёгкий ужин",
      // 30% of the user's own 2400 kcal target, not a hardcoded default.
      targetKcal: 720,
    });
    // AI recipes start unsaved — they only persist if kept or scheduled.
    expect(prismaMock.recipe.create.mock.calls[0][0].data.isSaved).toBe(false);
    expect(prismaMock.recipe.create.mock.calls[0][0].data.source).toBe("AI");
  });

  it("omits blank wishes rather than sending an empty string", async () => {
    prismaMock.product.findMany.mockResolvedValue([]);
    runTask.mockResolvedValue({
      title: "X",
      steps: ["a"],
      calories: 1,
      proteinG: 1,
      fatG: 1,
      carbsG: 1,
      cookTimeMin: 1,
      ingredients: [{ name: "a", amount: 1, unit: "г", wasInStock: true }],
    });
    prismaMock.recipe.create.mockResolvedValue(recipeRow);

    await generateRecipe("user-a", "   ");

    expect(runTask).toHaveBeenCalledWith("generate_recipe", {
      inStock: [],
      wishes: undefined,
      targetKcal: 720,
    });
  });
});
