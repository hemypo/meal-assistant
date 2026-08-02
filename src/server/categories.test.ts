import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  categoryMapping: { findMany: vi.fn(), createMany: vi.fn() },
};
const runTask = vi.fn();

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/ai/tasks", () => ({ runTask: (...a: unknown[]) => runTask(...a) }));

const { resolveCategories, normalizeName } = await import("./categories");

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.categoryMapping.createMany.mockResolvedValue({ count: 0 });
});

describe("normalizeName", () => {
  it("lowercases, trims and collapses whitespace", () => {
    expect(normalizeName("  Куриное   ФИЛЕ ")).toBe("куриное филе");
  });
});

describe("category cache (cost control, master plan §6.5)", () => {
  it("makes zero AI calls when every name is cached", async () => {
    prismaMock.categoryMapping.findMany.mockResolvedValue([
      { userId: "u1", normalizedName: "молоко", category: "Молочное" },
      { userId: "u1", normalizedName: "гречка", category: "Бакалея" },
    ]);

    const result = await resolveCategories("u1", ["Молоко", "Гречка"]);

    expect(runTask).not.toHaveBeenCalled();
    expect(result.get("молоко")).toBe("Молочное");
    expect(result.get("гречка")).toBe("Бакалея");
  });

  it("asks the AI only about names that are not cached", async () => {
    prismaMock.categoryMapping.findMany.mockResolvedValue([
      { userId: "u1", normalizedName: "молоко", category: "Молочное" },
    ]);
    runTask.mockResolvedValue([{ name: "Авокадо", category: "Овощи и фрукты" }]);

    await resolveCategories("u1", ["Молоко", "Авокадо"]);

    expect(runTask).toHaveBeenCalledTimes(1);
    expect(runTask).toHaveBeenCalledWith("categorize", { names: ["авокадо"] });
  });

  it("batches many unknown names into a single AI call", async () => {
    prismaMock.categoryMapping.findMany.mockResolvedValue([]);
    const names = Array.from({ length: 30 }, (_, i) => `продукт${i}`);
    runTask.mockResolvedValue(
      names.map((n) => ({ name: n, category: "Другое" })),
    );

    await resolveCategories("u1", names);

    expect(runTask).toHaveBeenCalledTimes(1);
  });

  it("deduplicates repeated names before asking", async () => {
    prismaMock.categoryMapping.findMany.mockResolvedValue([]);
    runTask.mockResolvedValue([{ name: "молоко", category: "Молочное" }]);

    await resolveCategories("u1", ["Молоко", "молоко", "  МОЛОКО  "]);

    expect(runTask).toHaveBeenCalledWith("categorize", { names: ["молоко"] });
  });

  it("persists newly learned mappings so the next call is free", async () => {
    prismaMock.categoryMapping.findMany.mockResolvedValue([]);
    runTask.mockResolvedValue([{ name: "Авокадо", category: "Овощи и фрукты" }]);

    await resolveCategories("u1", ["Авокадо"]);

    expect(prismaMock.categoryMapping.createMany).toHaveBeenCalledWith({
      data: [
        { userId: "u1", normalizedName: "авокадо", category: "Овощи и фрукты" },
      ],
      skipDuplicates: true,
    });
  });

  it("falls back to «Другое» when the AI is unavailable, rather than failing", async () => {
    prismaMock.categoryMapping.findMany.mockResolvedValue([]);
    runTask.mockRejectedValue(new Error("Gemini down"));

    const result = await resolveCategories("u1", ["Авокадо"]);

    expect(result.get("авокадо")).toBe("Другое");
    expect(prismaMock.categoryMapping.createMany).not.toHaveBeenCalled();
  });

  it("rejects a category the model invented outside the fixed list", async () => {
    prismaMock.categoryMapping.findMany.mockResolvedValue([]);
    runTask.mockResolvedValue([{ name: "Авокадо", category: "Экзотика" }]);

    const result = await resolveCategories("u1", ["Авокадо"]);

    expect(result.get("авокадо")).toBe("Другое");
  });

  it("fills a default for names the model silently skipped", async () => {
    prismaMock.categoryMapping.findMany.mockResolvedValue([]);
    runTask.mockResolvedValue([{ name: "Авокадо", category: "Овощи и фрукты" }]);

    const result = await resolveCategories("u1", ["Авокадо", "Манго"]);

    expect(result.get("манго")).toBe("Другое");
  });

  it("prefers the user's own mapping over a global one", async () => {
    prismaMock.categoryMapping.findMany.mockResolvedValue([
      { userId: null, normalizedName: "молоко", category: "Другое" },
      { userId: "u1", normalizedName: "молоко", category: "Молочное" },
    ]);

    const result = await resolveCategories("u1", ["Молоко"]);

    expect(result.get("молоко")).toBe("Молочное");
  });
});
