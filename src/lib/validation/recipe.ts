import { z } from "zod";
import { UNITS } from "@/lib/utils";

export const mealTypeSchema = z.enum([
  "BREAKFAST",
  "LUNCH",
  "DINNER",
  "SNACK",
]);

export const recipeIngredientSchema = z.object({
  name: z.string().trim().min(1).max(100),
  amount: z.coerce.number().positive().max(99999),
  unit: z.enum(UNITS).default("г"),
  wasInStock: z.boolean().default(true),
  estPrice: z.coerce.number().nonnegative().max(999999).nullable().optional(),
});

export const createRecipeSchema = z.object({
  title: z.string().trim().min(1, "Укажите название").max(200),
  steps: z.array(z.string().trim().min(1)).min(1, "Добавьте хотя бы один шаг"),
  calories: z.coerce.number().int().nonnegative().max(20000).nullable().optional(),
  proteinG: z.coerce.number().int().nonnegative().max(2000).nullable().optional(),
  fatG: z.coerce.number().int().nonnegative().max(2000).nullable().optional(),
  carbsG: z.coerce.number().int().nonnegative().max(2000).nullable().optional(),
  cookTimeMin: z.coerce.number().int().positive().max(1440).nullable().optional(),
  source: z.enum(["AI", "MANUAL"]).default("MANUAL"),
  isSaved: z.boolean().default(false),
  ingredients: z.array(recipeIngredientSchema).default([]),
});

export const updateRecipeSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  isSaved: z.boolean().optional(),
});

/** YYYY-MM-DD — the meal plan stores real calendar dates (CLAUDE.md §4). */
export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Дата должна быть в формате ГГГГ-ММ-ДД");

export const createMealEntrySchema = z.object({
  date: isoDateSchema,
  mealType: mealTypeSchema,
  recipeId: z.string().min(1),
});

export const mealPlanRangeSchema = z.object({
  from: isoDateSchema,
  to: isoDateSchema,
});

export type CreateRecipeInput = z.infer<typeof createRecipeSchema>;
export type CreateMealEntryInput = z.infer<typeof createMealEntrySchema>;
