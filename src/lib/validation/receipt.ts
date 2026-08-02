import { z } from "zod";
import { CATEGORIES, UNITS } from "@/lib/utils";
import { isoDateSchema } from "@/lib/validation/recipe";

export const receiptItemSchema = z.object({
  name: z.string().trim().min(1, "Укажите название").max(200),
  category: z.enum(CATEGORIES).nullable().optional(),
  quantity: z.coerce.number().positive("Количество должно быть больше 0").max(99999),
  unit: z.enum(UNITS).default("шт"),
  price: z.coerce.number().nonnegative().max(999999),
});

/** Photo upload guard — master plan §7. */
export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
] as const;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export const createReceiptSchema = z.discriminatedUnion("source", [
  z.object({
    source: z.literal("TEXT"),
    rawText: z.string().trim().min(1, "Вставьте текст чека").max(10000),
  }),
  z.object({
    source: z.literal("PHOTO"),
    imageBase64: z.string().min(1),
    mimeType: z.enum(ALLOWED_IMAGE_TYPES),
  }),
]);

export const updateReceiptSchema = z.object({
  store: z.string().trim().max(200).nullable().optional(),
  purchasedAt: isoDateSchema.nullable().optional(),
  total: z.coerce.number().nonnegative().max(9999999).nullable().optional(),
  items: z.array(receiptItemSchema).optional(),
});

export type ReceiptItemInput = z.infer<typeof receiptItemSchema>;
export type CreateReceiptInput = z.infer<typeof createReceiptSchema>;
export type UpdateReceiptInput = z.infer<typeof updateReceiptSchema>;
