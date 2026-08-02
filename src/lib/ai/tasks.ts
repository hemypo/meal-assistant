import "server-only";
import { z } from "zod";
import { ai, generationConfig, MODELS, type ModelTier } from "./client";
import {
  categorizeSchema,
  estimateKbjuSchema,
  estimatePriceSchema,
  generateRecipeSchema,
  parseBulkListSchema,
  suggestUnitSchema,
} from "./schemas";
import { CATEGORIES, UNITS } from "@/lib/utils";

/**
 * The task registry (master plan §6.3). Adding "AI help" to a new field means
 * adding one entry here — never a new endpoint.
 *
 * Prompts are deliberately terse: the responseSchema already pins the output
 * shape, so restating it in prose only burns input tokens.
 */

const categoryList = CATEGORIES.join(", ");
const unitList = UNITS.join(", ");

type TaskDef<I, O> = {
  tier: ModelTier;
  /** false => thinkingBudget 0 on `main` (4x fewer tokens; see client.ts). */
  reasoning: boolean;
  /** Rate-limit cost; batch tasks cost more than single-field ones. */
  weight: number;
  input: z.ZodType<I>;
  output: z.ZodType<O>;
  responseSchema: object;
  prompt: (payload: I) => string;
};

const categorize = {
  tier: "cheap",
  reasoning: false,
  weight: 1,
  input: z.object({ names: z.array(z.string().trim().min(1)).min(1).max(100) }),
  output: z.array(z.object({ name: z.string(), category: z.enum(CATEGORIES) })),
  responseSchema: categorizeSchema,
  prompt: ({ names }) =>
    `Категории: ${categoryList}.\nПрисвой категорию каждому продукту:\n${names.join("\n")}`,
} satisfies TaskDef<{ names: string[] }, { name: string; category: string }[]>;

const parseBulkList = {
  tier: "cheap",
  reasoning: false,
  weight: 3,
  input: z.object({ text: z.string().trim().min(1).max(5000) }),
  output: z.array(
    z.object({
      name: z.string(),
      category: z.enum(CATEGORIES),
      quantity: z.number().positive(),
      unit: z.enum(UNITS),
    }),
  ),
  responseSchema: parseBulkListSchema,
  prompt: ({ text }) =>
    `Категории: ${categoryList}. Единицы: ${unitList}.\n` +
    `Разбери список покупок на позиции. Нормализуй названия (с заглавной буквы, единственное число). ` +
    `Если количество не указано — 1 шт.\n\n${text}`,
} satisfies TaskDef<
  { text: string },
  { name: string; category: string; quantity: number; unit: string }[]
>;

const suggestUnit = {
  tier: "cheap",
  reasoning: false,
  weight: 1,
  input: z.object({ name: z.string().trim().min(1).max(100) }),
  output: z.object({ unit: z.enum(UNITS) }),
  responseSchema: suggestUnitSchema,
  prompt: ({ name }) =>
    `Единицы: ${unitList}. Самая естественная единица для «${name}»?`,
} satisfies TaskDef<{ name: string }, { unit: string }>;

const estimatePrice = {
  tier: "cheap",
  reasoning: false,
  weight: 1,
  input: z.object({
    name: z.string().trim().min(1).max(100),
    quantity: z.number().positive(),
    unit: z.enum(UNITS),
  }),
  output: z.object({ price: z.number().nonnegative() }),
  responseSchema: estimatePriceSchema,
  prompt: ({ name, quantity, unit }) =>
    `Ориентировочная розничная цена в рублях за ${quantity} ${unit} «${name}» в России, 2026 год. Только число.`,
} satisfies TaskDef<
  { name: string; quantity: number; unit: string },
  { price: number }
>;

const kbjuOutput = {
  calories: z.number().int().nonnegative().max(20000),
  proteinG: z.number().int().nonnegative().max(2000),
  fatG: z.number().int().nonnegative().max(2000),
  carbsG: z.number().int().nonnegative().max(2000),
};

/**
 * Recipe generation. Measured reasoning on vs off over 3 prompts:
 * on = 7843ms / 2345 tok / 21 kcal internal mismatch;
 * off = 2574ms / 735 tok / 1 kcal mismatch. Off wins on every axis, so this
 * generative task runs reasoning-off too (CLAUDE.md §7, 2026-08-02).
 */
const generateRecipe = {
  tier: "main",
  reasoning: false,
  weight: 4,
  input: z.object({
    inStock: z.array(z.string()).max(200),
    wishes: z.string().trim().max(300).optional(),
  }),
  output: z.object({
    title: z.string().min(1),
    steps: z.array(z.string().min(1)).min(1),
    cookTimeMin: z.number().int().positive().max(1440),
    ...kbjuOutput,
    ingredients: z
      .array(
        z.object({
          name: z.string().min(1),
          amount: z.number().positive(),
          unit: z.enum(UNITS),
          wasInStock: z.boolean(),
          estPrice: z.number().nonnegative().max(999999).optional(),
        }),
      )
      .min(1),
  }),
  responseSchema: generateRecipeSchema,
  prompt: ({ inStock, wishes }) =>
    `В наличии: ${inStock.length ? inStock.join(", ") : "ничего"}.\n` +
    (wishes ? `Пожелания: ${wishes}.\n` : "") +
    `Придумай один рецепт, преимущественно из имеющегося. Единицы: ${unitList}. ` +
    `wasInStock=false для недостающих ингредиентов, для них укажи estPrice в рублях. ` +
    `Шаги — короткие, по одному действию. КБЖУ на всё блюдо.`,
} satisfies TaskDef<
  { inStock: string[]; wishes?: string },
  {
    title: string;
    steps: string[];
    cookTimeMin: number;
    calories: number;
    proteinG: number;
    fatG: number;
    carbsG: number;
    ingredients: {
      name: string;
      amount: number;
      unit: string;
      wasInStock: boolean;
      estPrice?: number;
    }[];
  }
>;

/** КБЖУ assist for manually entered recipes. */
const estimateKbju = {
  tier: "cheap",
  reasoning: false,
  weight: 1,
  input: z.object({
    title: z.string().trim().max(200).optional(),
    ingredients: z.array(z.string().trim().min(1)).min(1).max(50),
  }),
  output: z.object(kbjuOutput),
  responseSchema: estimateKbjuSchema,
  prompt: ({ title, ingredients }) =>
    `Оцени КБЖУ на всё блюдо${title ? ` «${title}»` : ""} из ингредиентов:\n${ingredients.join("\n")}`,
} satisfies TaskDef<
  { title?: string; ingredients: string[] },
  { calories: number; proteinG: number; fatG: number; carbsG: number }
>;

export const TASKS = {
  categorize,
  parse_bulk_list: parseBulkList,
  suggest_unit: suggestUnit,
  estimate_price: estimatePrice,
  generate_recipe: generateRecipe,
  estimate_kbju: estimateKbju,
} as const;

export type TaskName = keyof typeof TASKS;
export const TASK_NAMES = Object.keys(TASKS) as TaskName[];

export class AiTaskError extends Error {}

/**
 * Runs a registry task end to end: validate input → call Gemini with a
 * responseSchema → validate the model's output before it reaches the caller.
 * The output check matters — a schema-constrained model can still return
 * something semantically wrong, and nothing downstream should trust it blindly.
 */
export async function runTask<T extends TaskName>(
  task: T,
  payload: unknown,
): Promise<z.infer<(typeof TASKS)[T]["output"]>> {
  const def = TASKS[task];

  const parsedInput = def.input.safeParse(payload);
  if (!parsedInput.success) {
    throw new AiTaskError("Некорректные данные для ИИ-задачи");
  }

  const response = await ai.models.generateContent({
    model: MODELS[def.tier],
    contents: def.prompt(parsedInput.data as never),
    config: generationConfig({
      tier: def.tier,
      responseSchema: def.responseSchema,
      reasoning: def.reasoning,
    }),
  });

  const text = response.text;
  if (!text) throw new AiTaskError("Пустой ответ от ИИ");

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new AiTaskError("ИИ вернул некорректный JSON");
  }

  const parsedOutput = def.output.safeParse(raw);
  if (!parsedOutput.success) {
    throw new AiTaskError("Ответ ИИ не прошёл проверку схемы");
  }

  return parsedOutput.data as never;
}
