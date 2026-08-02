import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Fixed unit list — CLAUDE.md §4. */
export const UNITS = ["шт", "г", "кг", "мл", "л", "упак"] as const;
export type Unit = (typeof UNITS)[number];

/** Category list for Phase 1 manual select; AI assigns these from Phase 2 on. */
export const CATEGORIES = [
  "Овощи и фрукты",
  "Мясо и рыба",
  "Молочное",
  "Бакалея",
  "Напитки",
  "Заморозка",
  "Бытовое",
  "Другое",
] as const;

/** ru-RU number formatting, per MASTER.md §6 checklist. */
export function formatQuantity(value: number): string {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 3 }).format(
    value,
  );
}

export function formatPrice(value: number): string {
  return `${new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)} ₽`;
}

/** Russian plurals: 1 позиция / 2 позиции / 5 позиций — MASTER.md §6. */
export function plural(n: number, one: string, few: string, many: string) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}
