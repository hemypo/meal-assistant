import "server-only";
import { z } from "zod";
import { ai, generationConfig, MODELS, type ModelTier } from "./client";
import {
  categorizeSchema,
  estimatePriceSchema,
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

export const TASKS = {
  categorize,
  parse_bulk_list: parseBulkList,
  suggest_unit: suggestUnit,
  estimate_price: estimatePrice,
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
