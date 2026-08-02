import { z } from "zod";
import { CATEGORIES, UNITS } from "@/lib/utils";

export const productStatusSchema = z.enum(["IN_STOCK", "TO_BUY"]);

export const createProductSchema = z.object({
  name: z.string().trim().min(1, "Укажите название").max(100),
  category: z.enum(CATEGORIES).default("Другое"),
  status: productStatusSchema.default("TO_BUY"),
  quantity: z.coerce.number().positive("Количество должно быть больше 0").max(99999),
  unit: z.enum(UNITS).default("шт"),
  estPrice: z.coerce.number().nonnegative().max(999999).nullable().optional(),
});

/** All fields optional — used for inline edits and the status toggle. */
export const updateProductSchema = createProductSchema.partial();

export const listProductsSchema = z.object({
  status: productStatusSchema.optional(),
  category: z.string().optional(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
