import { z } from "zod";
import { isoDateSchema } from "@/lib/validation/recipe";

/** Expense categories — «Продукты» is what a confirmed receipt records. */
export const EXPENSE_CATEGORIES = [
  "Продукты",
  "Бытовое",
  "Кафе и рестораны",
  "Здоровье",
  "Другое",
] as const;

export const createExpenseSchema = z.object({
  date: isoDateSchema,
  category: z.enum(EXPENSE_CATEGORIES).default("Продукты"),
  amount: z.coerce.number().positive("Сумма должна быть больше 0").max(9999999),
  note: z.string().trim().max(200).nullable().optional(),
});

export const rangeSchema = z.object({
  from: isoDateSchema,
  to: isoDateSchema,
});

export const createWeightSchema = z.object({
  date: isoDateSchema,
  weightKg: z.coerce
    .number()
    .min(30, "Вес должен быть от 30 до 250 кг")
    .max(250, "Вес должен быть от 30 до 250 кг"),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type CreateWeightInput = z.infer<typeof createWeightSchema>;
