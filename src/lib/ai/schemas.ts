import { CATEGORIES, UNITS } from "@/lib/utils";

/**
 * Gemini responseSchema definitions (master plan §6.2).
 * Enums are pinned to the app's fixed lists so the model cannot invent a
 * category or a unit the database would reject.
 */

const CATEGORY_ENUM = {
  type: "STRING",
  enum: [...CATEGORIES],
} as const;

const UNIT_ENUM = {
  type: "STRING",
  enum: [...UNITS],
} as const;

/** categorize: names[] -> { name, category }[] */
export const categorizeSchema = {
  type: "ARRAY",
  items: {
    type: "OBJECT",
    properties: { name: { type: "STRING" }, category: CATEGORY_ENUM },
    required: ["name", "category"],
  },
} as const;

/** parse_bulk_list: raw multiline text -> product drafts */
export const parseBulkListSchema = {
  type: "ARRAY",
  items: {
    type: "OBJECT",
    properties: {
      name: { type: "STRING" },
      category: CATEGORY_ENUM,
      quantity: { type: "NUMBER" },
      unit: UNIT_ENUM,
    },
    required: ["name", "category", "quantity", "unit"],
  },
} as const;

/** suggest_unit: a product name -> the most natural unit */
export const suggestUnitSchema = {
  type: "OBJECT",
  properties: { unit: UNIT_ENUM },
  required: ["unit"],
} as const;

/** estimate_price: name + quantity + unit -> a rough RUB price */
export const estimatePriceSchema = {
  type: "OBJECT",
  properties: { price: { type: "NUMBER" } },
  required: ["price"],
} as const;

/** generate_recipe: in-stock list + wishes -> a full recipe with КБЖУ */
export const generateRecipeSchema = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING" },
    steps: { type: "ARRAY", items: { type: "STRING" } },
    calories: { type: "INTEGER" },
    proteinG: { type: "INTEGER" },
    fatG: { type: "INTEGER" },
    carbsG: { type: "INTEGER" },
    cookTimeMin: { type: "INTEGER" },
    ingredients: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          amount: { type: "NUMBER" },
          unit: UNIT_ENUM,
          wasInStock: { type: "BOOLEAN" },
          estPrice: { type: "NUMBER" },
        },
        required: ["name", "amount", "unit", "wasInStock"],
      },
    },
  },
  required: [
    "title",
    "steps",
    "calories",
    "proteinG",
    "fatG",
    "carbsG",
    "cookTimeMin",
    "ingredients",
  ],
} as const;

/** estimate_kbju: manual recipe ingredients -> КБЖУ estimate */
export const estimateKbjuSchema = {
  type: "OBJECT",
  properties: {
    calories: { type: "INTEGER" },
    proteinG: { type: "INTEGER" },
    fatG: { type: "INTEGER" },
    carbsG: { type: "INTEGER" },
  },
  required: ["calories", "proteinG", "fatG", "carbsG"],
} as const;
