import { z } from "zod";
import { CATEGORIES } from "@/lib/utils";

/** YYYY-MM */
export const monthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Месяц в формате ГГГГ-ММ");

export const budgetSchema = z.object({
  month: monthSchema,
  // "" is the overall limit for the month; anything else must be a real category.
  category: z.union([z.literal(""), z.enum(CATEGORIES)]).default(""),
  limitAmount: z.coerce.number().nonnegative().max(9999999),
});

export type BudgetInput = z.infer<typeof budgetSchema>;
