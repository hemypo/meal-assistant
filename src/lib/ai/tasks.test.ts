import { beforeEach, describe, expect, it, vi } from "vitest";

const generateContent = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("./client", () => ({
  ai: { models: { generateContent: (...a: unknown[]) => generateContent(...a) } },
  MODELS: { cheap: "cheap-model", main: "main-model" },
  generationConfig: ({
    tier,
    responseSchema,
    reasoning,
  }: {
    tier: string;
    responseSchema: object;
    reasoning: boolean;
  }) => ({
    responseMimeType: "application/json",
    responseSchema,
    ...(tier === "main" && !reasoning
      ? { thinkingConfig: { thinkingBudget: 0 } }
      : {}),
  }),
}));

const { runTask, AiTaskError, TASKS } = await import("./tasks");

const reply = (value: unknown) => ({ text: JSON.stringify(value) });

beforeEach(() => vi.clearAllMocks());

describe("input validation", () => {
  it("rejects a payload that does not match the task's input schema", async () => {
    await expect(runTask("suggest_unit", { name: "" })).rejects.toBeInstanceOf(
      AiTaskError,
    );
    expect(generateContent).not.toHaveBeenCalled();
  });
});

describe("output validation — the model is never trusted blindly", () => {
  it("rejects a category outside the fixed list", async () => {
    generateContent.mockResolvedValue(
      reply([{ name: "Авокадо", category: "Экзотика" }]),
    );

    await expect(
      runTask("categorize", { names: ["Авокадо"] }),
    ).rejects.toBeInstanceOf(AiTaskError);
  });

  it("rejects a unit outside the fixed list", async () => {
    generateContent.mockResolvedValue(reply({ unit: "ведро" }));

    await expect(
      runTask("suggest_unit", { name: "Молоко" }),
    ).rejects.toBeInstanceOf(AiTaskError);
  });

  it("rejects a negative price", async () => {
    generateContent.mockResolvedValue(reply({ price: -10 }));

    await expect(
      runTask("estimate_price", { name: "Молоко", quantity: 1, unit: "л" }),
    ).rejects.toBeInstanceOf(AiTaskError);
  });

  it("rejects a non-positive quantity from bulk parsing", async () => {
    generateContent.mockResolvedValue(
      reply([{ name: "Молоко", category: "Молочное", quantity: 0, unit: "л" }]),
    );

    await expect(
      runTask("parse_bulk_list", { text: "молоко" }),
    ).rejects.toBeInstanceOf(AiTaskError);
  });

  it("rejects malformed JSON", async () => {
    generateContent.mockResolvedValue({ text: "not json at all" });

    await expect(
      runTask("categorize", { names: ["Молоко"] }),
    ).rejects.toBeInstanceOf(AiTaskError);
  });

  it("rejects an empty response", async () => {
    generateContent.mockResolvedValue({ text: "" });

    await expect(
      runTask("categorize", { names: ["Молоко"] }),
    ).rejects.toBeInstanceOf(AiTaskError);
  });

  it("returns validated data on a well-formed response", async () => {
    generateContent.mockResolvedValue(
      reply([{ name: "Молоко", category: "Молочное" }]),
    );

    await expect(runTask("categorize", { names: ["Молоко"] })).resolves.toEqual([
      { name: "Молоко", category: "Молочное" },
    ]);
  });
});

describe("token discipline", () => {
  it("sends a responseSchema on every task — no free-text parsing", () => {
    for (const def of Object.values(TASKS)) {
      expect(def.responseSchema).toBeTruthy();
    }
  });

  it("runs extraction tasks without reasoning, on the cheap tier", () => {
    // Every Phase 2 task is extraction-shaped; reasoning would cost ~4x tokens.
    for (const def of Object.values(TASKS)) {
      expect(def.reasoning).toBe(false);
      expect(def.tier).toBe("cheap");
    }
  });

  it("charges bulk parsing a heavier rate-limit weight than single fields", () => {
    expect(TASKS.parse_bulk_list.weight).toBeGreaterThan(
      TASKS.suggest_unit.weight,
    );
  });
});
