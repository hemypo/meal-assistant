import { prisma } from "@/lib/db";
import { getSummary } from "@/server/analytics";
import type { BudgetInput } from "@/lib/validation/budget";

/**
 * Budgets and the derived finance figures.
 *
 * Everything here is plain arithmetic on the user's own rows. The AI layer
 * (`review_spending`) only ever *interprets* these numbers — same discipline
 * as the nutrition target, and for the same reason: the model is unreliable
 * at sums and this is the user's money.
 */

const round2 = (value: number) => Math.round(value * 100) / 100;
const num = (v: { toString(): string }) => Number(v.toString());

export type BudgetDTO = {
  /** "" = the overall monthly limit. */
  category: string;
  limitAmount: number;
  spent: number;
  /** 0–100+, uncapped so an over-run is visible rather than pinned at 100. */
  usedPct: number;
  remaining: number;
  overspent: boolean;
};

export type MonthBounds = { from: string; to: string; days: number };

/** First and last day of a YYYY-MM, in UTC, as ISO dates. */
export function monthBounds(month: string): MonthBounds {
  const [year, mon] = month.split("-").map(Number);
  const days = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  return {
    from: `${month}-01`,
    to: `${month}-${String(days).padStart(2, "0")}`,
    days,
  };
}

export async function listBudgets(
  userId: string,
  month: string,
): Promise<BudgetDTO[]> {
  const [rows, summary] = await Promise.all([
    prisma.budget.findMany({ where: { userId, month } }),
    getSummary(userId, monthBounds(month)),
  ]);

  const spentByCategory = new Map(
    summary.byCategory.map((c) => [c.category, c.amount]),
  );

  return rows
    .map((row) => {
      const limitAmount = num(row.limitAmount);
      const spent =
        row.category === ""
          ? summary.total
          : (spentByCategory.get(row.category) ?? 0);
      return {
        category: row.category,
        limitAmount,
        spent: round2(spent),
        usedPct: limitAmount === 0 ? 0 : round2((spent / limitAmount) * 100),
        remaining: round2(limitAmount - spent),
        overspent: spent > limitAmount,
      };
    })
    .sort((a, b) => a.category.localeCompare(b.category, "ru"));
}

export async function upsertBudget(
  userId: string,
  input: BudgetInput,
): Promise<BudgetDTO[]> {
  await prisma.budget.upsert({
    where: {
      userId_month_category: {
        userId,
        month: input.month,
        category: input.category,
      },
    },
    create: { ...input, userId },
    update: { limitAmount: input.limitAmount },
  });
  return listBudgets(userId, input.month);
}

export async function deleteBudget(
  userId: string,
  month: string,
  category: string,
): Promise<boolean> {
  const { count } = await prisma.budget.deleteMany({
    where: { userId, month, category },
  });
  return count > 0;
}

export type FinanceForecast = {
  month: string;
  spent: number;
  daysElapsed: number;
  daysInMonth: number;
  /** Projected month-end total at the current daily rate. */
  projected: number;
  dailyAverage: number;
  /** Present only when an overall budget exists for the month. */
  overallLimit: number | null;
  projectedOverrun: number | null;
};

/**
 * Straight-line projection: what the month ends at if spending continues at
 * the rate observed so far. No model involved — this is division.
 */
export async function getForecast(
  userId: string,
  month: string,
  today = new Date(),
): Promise<FinanceForecast> {
  const bounds = monthBounds(month);
  const summary = await getSummary(userId, bounds);

  const isCurrentMonth = month === today.toISOString().slice(0, 7);
  const daysElapsed = isCurrentMonth
    ? today.getUTCDate()
    : // A past (or future) month is complete as far as projection goes.
      bounds.days;

  const dailyAverage = daysElapsed === 0 ? 0 : summary.total / daysElapsed;
  const projected = round2(dailyAverage * bounds.days);

  const overall = await prisma.budget.findFirst({
    where: { userId, month, category: "" },
    select: { limitAmount: true },
  });
  const overallLimit = overall ? num(overall.limitAmount) : null;

  return {
    month,
    spent: summary.total,
    daysElapsed,
    daysInMonth: bounds.days,
    projected,
    dailyAverage: round2(dailyAverage),
    overallLimit,
    projectedOverrun:
      overallLimit === null ? null : round2(projected - overallLimit),
  };
}

export type ShoppingEstimate = {
  itemCount: number;
  /** Items carrying an estPrice. */
  pricedCount: number;
  estimatedTotal: number;
};

/** What the next shop costs, from the TO_BUY list's estimated prices. */
export async function getShoppingEstimate(
  userId: string,
): Promise<ShoppingEstimate> {
  const items = await prisma.product.findMany({
    where: { userId, status: "TO_BUY" },
    select: { estPrice: true, quantity: true },
  });

  let estimatedTotal = 0;
  let pricedCount = 0;
  for (const item of items) {
    if (item.estPrice === null) continue;
    pricedCount++;
    estimatedTotal += num(item.estPrice);
  }

  return {
    itemCount: items.length,
    pricedCount,
    estimatedTotal: round2(estimatedTotal),
  };
}

export type MealCost = {
  plannedMeals: number;
  groceriesSpent: number;
  /** null when nothing was planned — dividing by zero helps nobody. */
  averagePerMeal: number | null;
};

/**
 * Average cost of a planned meal for the month.
 *
 * Deliberately an average of real grocery spend over meals actually planned,
 * not a per-recipe costing: receipts do not map cleanly onto recipe
 * ingredients, and inventing that precision would be worse than useless.
 */
export async function getMealCost(
  userId: string,
  month: string,
): Promise<MealCost> {
  const bounds = monthBounds(month);
  const [summary, plannedMeals] = await Promise.all([
    getSummary(userId, bounds),
    prisma.mealPlanEntry.count({
      where: {
        userId,
        date: { gte: new Date(bounds.from), lte: new Date(bounds.to) },
      },
    }),
  ]);

  const groceries =
    summary.byCategory.find((c) => c.category === "Продукты")?.amount ?? 0;

  return {
    plannedMeals,
    groceriesSpent: groceries,
    averagePerMeal:
      plannedMeals === 0 ? null : round2(groceries / plannedMeals),
  };
}
