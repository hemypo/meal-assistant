import { prisma } from "@/lib/db";
import { fromIsoDate, toIsoDate } from "@/server/mealplan";
import type { CreateWeightInput } from "@/lib/validation/finance";

export type WeightEntryDTO = {
  /** YYYY-MM-DD */
  date: string;
  weightKg: number;
};

export type WeightOverview = {
  entries: WeightEntryDTO[];
  goalKg: number;
  latestKg: number | null;
  /** Positive means still to lose; negative means already past the goal. */
  toGoalKg: number | null;
  /** Average daily kcal over the same range, from the meal calendar. */
  avgKcal: number | null;
};

type Decimalish = { toString(): string };
const toNumber = (value: Decimalish) => Number(value.toString());
const round1 = (value: number) => Math.round(value * 10) / 10;

/** One entry per day — a second save for the same date replaces the first. */
export async function upsertWeight(
  userId: string,
  input: CreateWeightInput,
): Promise<WeightEntryDTO> {
  const date = fromIsoDate(input.date);
  const row = await prisma.weightEntry.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date, weightKg: input.weightKg },
    update: { weightKg: input.weightKg },
  });
  return { date: toIsoDate(row.date), weightKg: toNumber(row.weightKg) };
}

export async function deleteWeight(
  userId: string,
  date: string,
): Promise<boolean> {
  const { count } = await prisma.weightEntry.deleteMany({
    where: { userId, date: fromIsoDate(date) },
  });
  return count > 0;
}

export async function getWeightOverview(
  userId: string,
  range: { from: string; to: string },
): Promise<WeightOverview> {
  const from = fromIsoDate(range.from);
  const to = fromIsoDate(range.to);

  const [rows, user, mealEntries] = await Promise.all([
    prisma.weightEntry.findMany({
      where: { userId, date: { gte: from, lte: to } },
      orderBy: { date: "asc" },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { weightGoalKg: true },
    }),
    prisma.mealPlanEntry.findMany({
      where: { userId, date: { gte: from, lte: to } },
      select: { date: true, recipe: { select: { calories: true } } },
    }),
  ]);

  const entries = rows.map((row) => ({
    date: toIsoDate(row.date),
    weightKg: toNumber(row.weightKg),
  }));

  const goalKg = user ? toNumber(user.weightGoalKg) : 0;
  const latestKg = entries.length ? entries[entries.length - 1].weightKg : null;

  // Average over days that actually have planned meals — dividing by every
  // day in the range would understate intake on a half-planned week.
  const kcalByDay = new Map<string, number>();
  for (const entry of mealEntries) {
    if (entry.recipe.calories === null) continue;
    const day = toIsoDate(entry.date);
    kcalByDay.set(day, (kcalByDay.get(day) ?? 0) + entry.recipe.calories);
  }
  const avgKcal = kcalByDay.size
    ? Math.round(
        [...kcalByDay.values()].reduce((sum, v) => sum + v, 0) / kcalByDay.size,
      )
    : null;

  return {
    entries,
    goalKg,
    latestKg,
    toGoalKg: latestKg === null ? null : round1(latestKg - goalKg),
    avgKcal,
  };
}
