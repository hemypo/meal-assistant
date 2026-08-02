/**
 * Week helpers for the meal calendar. All dates are real calendar dates in
 * YYYY-MM-DD (CLAUDE.md §4 — never abstract weekdays), and every conversion
 * goes through UTC so a user behind UTC never sees the day shift.
 */

export const MEAL_TYPES = ["BREAKFAST", "LUNCH", "DINNER", "SNACK"] as const;
export type MealTypeKey = (typeof MEAL_TYPES)[number];

export const MEAL_LABELS: Record<MealTypeKey, string> = {
  BREAKFAST: "Завтрак",
  LUNCH: "Обед",
  DINNER: "Ужин",
  SNACK: "Перекус",
};

const WEEKDAYS = ["ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "ВС"];

const MONTHS_GENITIVE = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

export function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function todayIso(): string {
  const now = new Date();
  return toIso(
    new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())),
  );
}

/** Monday of the week containing `iso` (ISO weeks start Monday). */
export function startOfWeek(iso: string): string {
  const date = new Date(`${iso}T00:00:00.000Z`);
  const day = date.getUTCDay(); // 0 = Sunday
  const offset = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + offset);
  return toIso(date);
}

export function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return toIso(date);
}

export function weekDays(mondayIso: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(mondayIso, i));
}

export function weekdayLabel(iso: string): string {
  const day = new Date(`${iso}T00:00:00.000Z`).getUTCDay();
  return WEEKDAYS[day === 0 ? 6 : day - 1];
}

export function dayOfMonth(iso: string): number {
  return new Date(`${iso}T00:00:00.000Z`).getUTCDate();
}

/** «2 августа» — MASTER.md §6 date formatting. */
export function longDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00.000Z`);
  return `${date.getUTCDate()} ${MONTHS_GENITIVE[date.getUTCMonth()]}`;
}

/** «28 июля — 3 августа» for the PeriodNav label. */
export function weekRangeLabel(mondayIso: string): string {
  return `${longDate(mondayIso)} — ${longDate(addDays(mondayIso, 6))}`;
}

/** «2 авг» — compact axis label for charts. */
export function shortDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00.000Z`);
  return `${date.getUTCDate()} ${MONTHS_GENITIVE[date.getUTCMonth()].slice(0, 3)}`;
}

const MONTHS_NOMINATIVE = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

/** First day of the month containing `iso`. */
export function startOfMonth(iso: string): string {
  const date = new Date(`${iso}T00:00:00.000Z`);
  return toIso(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)));
}

/** Last day of the month containing `iso` (day 0 of the next month). */
export function endOfMonth(iso: string): string {
  const date = new Date(`${iso}T00:00:00.000Z`);
  return toIso(
    new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)),
  );
}

/** Shift by whole months, clamped to the target month's length. */
export function addMonths(iso: string, months: number): string {
  const date = new Date(`${iso}T00:00:00.000Z`);
  return toIso(
    new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1)),
  );
}

/** «Август 2026» for the PeriodNav label. */
export function monthLabel(iso: string): string {
  const date = new Date(`${iso}T00:00:00.000Z`);
  return `${MONTHS_NOMINATIVE[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}
