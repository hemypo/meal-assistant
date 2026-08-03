import "server-only";
import { z } from "zod";
import { ai, generationConfig, MODELS, type ModelTier } from "./client";
import {
  categorizeSchema,
  estimateKbjuSchema,
  estimatePriceSchema,
  explainNutritionSchema,
  generateRecipeSchema,
  parseBulkListSchema,
  parseReceiptSchema,
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

/**
 * A prompt is normally a plain string. Vision tasks return SDK `contents`
 * parts instead, so a receipt photo can be sent as inline base64.
 */
type PromptPart = { text: string } | { inlineData: { mimeType: string; data: string } };
export type PromptContent = string | [{ parts: PromptPart[] }];

type TaskDef<I, O> = {
  tier: ModelTier;
  /** false => thinkingBudget 0 on `main` (4x fewer tokens; see client.ts). */
  reasoning: boolean;
  /** Rate-limit cost; batch tasks cost more than single-field ones. */
  weight: number;
  input: z.ZodType<I>;
  output: z.ZodType<O>;
  responseSchema: object;
  prompt: (payload: I) => PromptContent;
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
    /** Calories this single dish should land near, from the user's target. */
    targetKcal: z.number().int().positive().max(5000).optional(),
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
  prompt: ({ inStock, wishes, targetKcal }) =>
    `В наличии: ${inStock.length ? inStock.join(", ") : "ничего"}.\n` +
    (wishes ? `Пожелания: ${wishes}.\n` : "") +
    (targetKcal
      ? `Целевая калорийность блюда: около ${targetKcal} ккал — подбери порции под неё.\n`
      : "") +
    `Придумай один рецепт, преимущественно из имеющегося. Единицы: ${unitList}. ` +
    `wasInStock=false для недостающих ингредиентов, для них укажи estPrice в рублях. ` +
    `Шаги — короткие, по одному действию. КБЖУ на всё блюдо.`,
} satisfies TaskDef<
  { inStock: string[]; wishes?: string; targetKcal?: number },
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

const RECEIPT_RULES =
  `Распознай кассовый чек. purchasedAt в формате ГГГГ-ММ-ДД. ` +
  `price — сумма за всю позицию, не цена за единицу. Единицы: ${unitList}. Категории: ${categoryList}. ` +
  `Не включай в items пакеты, скидки, бонусы и служебные строки. ` +
  // The expense must equal what was actually paid, so the total is the printed
  // ИТОГ — it may legitimately exceed the sum of items we kept.
  `total — итоговая сумма чека РОВНО как напечатана (ИТОГ), даже если она больше суммы items.`;

/**
 * One task, two sources (master plan §6.2): a photo goes to Gemini Vision as
 * inline base64, pasted text goes as plain text — the same responseSchema and
 * the same downstream draft pipeline either way.
 *
 * Measured on a real receipt image: reasoning on = 6815ms / 2896 tok,
 * off = 1272ms / 1320 tok, with identical item extraction. Off it is.
 */
const parseReceipt = {
  tier: "main",
  reasoning: false,
  weight: 5,
  input: z
    .object({
      imageBase64: z.string().min(1).optional(),
      mimeType: z.string().min(1).optional(),
      rawText: z.string().trim().min(1).max(10000).optional(),
    })
    .refine((v) => Boolean(v.imageBase64) !== Boolean(v.rawText), {
      message: "Нужен либо снимок, либо текст",
    }),
  output: z.object({
    store: z.string().optional(),
    purchasedAt: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    total: z.number().nonnegative().max(9999999).optional(),
    items: z
      .array(
        z.object({
          name: z.string().min(1),
          quantity: z.number().positive(),
          unit: z.enum(UNITS),
          price: z.number().nonnegative().max(999999),
          category: z.enum(CATEGORIES).optional(),
        }),
      )
      .min(1, "В чеке не найдено ни одной позиции"),
  }),
  responseSchema: parseReceiptSchema,
  prompt: ({ imageBase64, mimeType, rawText }) =>
    imageBase64
      ? ([
          {
            parts: [
              { text: RECEIPT_RULES },
              {
                inlineData: {
                  mimeType: mimeType ?? "image/jpeg",
                  data: imageBase64,
                },
              },
            ],
          },
        ] as const satisfies PromptContent)
      : `${RECEIPT_RULES}\n\n${rawText}`,
} satisfies TaskDef<
  { imageBase64?: string; mimeType?: string; rawText?: string },
  {
    store?: string;
    purchasedAt?: string;
    total?: number;
    items: {
      name: string;
      quantity: number;
      unit: string;
      price: number;
      category?: string;
    }[];
  }
>;

/**
 * Explains an ALREADY-COMPUTED calorie target and proposes a macro split.
 *
 * The kcal number is deliberately an input, not an output: Mifflin-St Jeor is
 * exact arithmetic and the model measurably fumbles sums (see §7). AI is used
 * here for what it is good at — wording and nutritional judgement.
 */
const explainNutrition = {
  tier: "cheap",
  reasoning: false,
  weight: 2,
  input: z.object({
    kcal: z.number().int().positive().max(10000),
    goal: z.enum(["LOSE", "MAINTAIN", "GAIN"]),
    activity: z.string().min(1).max(100),
    weightKg: z.number().positive().max(400),
    goalWeightKg: z.number().positive().max(400),
  }),
  output: z.object({
    summary: z.string().min(1).max(600),
    proteinG: z.number().int().nonnegative().max(600),
    fatG: z.number().int().nonnegative().max(400),
    carbsG: z.number().int().nonnegative().max(900),
    tips: z.array(z.string().min(1).max(200)).max(4),
  }),
  responseSchema: explainNutritionSchema,
  prompt: ({ kcal, goal, activity, weightKg, goalWeightKg }) =>
    `Суточная норма уже рассчитана: ${kcal} ккал. НЕ пересчитывай её.\n` +
    `Цель: ${goal === "LOSE" ? "снизить вес" : goal === "GAIN" ? "набрать вес" : "поддерживать вес"}. ` +
    `Активность: ${activity}. Текущий вес: ${weightKg} кг, целевой: ${goalWeightKg} кг.\n` +
    `Предложи разбивку Б/Ж/У в граммах ровно на ${kcal} ккал (белок 4 ккал/г, жир 9, углеводы 4). ` +
    `summary — 2–3 предложения простым языком, без медицинских обещаний. ` +
    `tips — до 4 коротких практических советов по питанию.`,
} satisfies TaskDef<
  {
    kcal: number;
    goal: string;
    activity: string;
    weightKg: number;
    goalWeightKg: number;
  },
  {
    summary: string;
    proteinG: number;
    fatG: number;
    carbsG: number;
    tips: string[];
  }
>;

export const TASKS = {
  categorize,
  explain_nutrition: explainNutrition,
  parse_bulk_list: parseBulkList,
  suggest_unit: suggestUnit,
  estimate_price: estimatePrice,
  generate_recipe: generateRecipe,
  estimate_kbju: estimateKbju,
  parse_receipt: parseReceipt,
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

  const request = {
    model: MODELS[def.tier],
    contents: def.prompt(parsedInput.data as never),
    config: generationConfig({
      tier: def.tier,
      responseSchema: def.responseSchema,
      reasoning: def.reasoning,
    }),
  };

  // Transient `fetch failed` errors were observed hitting the API in practice.
  // One retry turns a user-visible failure into a slightly slower success.
  // Only the call is retried — a schema-invalid response is a real failure and
  // retrying it would just burn tokens.
  let response;
  try {
    response = await ai.models.generateContent(request);
  } catch {
    response = await ai.models.generateContent(request);
  }

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
