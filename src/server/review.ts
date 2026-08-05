import { runTask } from "@/lib/ai/tasks";
import { getSummary } from "@/server/analytics";
import { getForecast, listBudgets, monthBounds } from "@/server/budgets";

export type SpendingReview = {
  month: string;
  /** The exact figures the model was given — the UI shows these, not its prose. */
  figures: {
    total: number;
    previousTotal: number | null;
    projected: number;
    byCategory: { category: string; amount: number; share: number }[];
  };
  summary: string;
  observations: string[];
  suggestions: string[];
};

/** Previous YYYY-MM, handling the January rollover. */
function previousMonth(month: string): string {
  const [year, mon] = month.split("-").map(Number);
  const d = new Date(Date.UTC(year, mon - 2, 1));
  return d.toISOString().slice(0, 7);
}

/**
 * Builds the monthly spending review.
 *
 * Every number is computed here and passed *into* the model; the model returns
 * only prose. That is what makes the accept criterion — the review reconciling
 * exactly with /api/analytics/summary — true by construction rather than by
 * hoping the model did its sums.
 */
export async function buildSpendingReview(
  userId: string,
  month: string,
): Promise<SpendingReview> {
  const [summary, previous, forecast, budgets] = await Promise.all([
    getSummary(userId, monthBounds(month)),
    getSummary(userId, monthBounds(previousMonth(month))),
    getForecast(userId, month),
    listBudgets(userId, month),
  ]);

  const figures = {
    total: summary.total,
    // A month with no data is meaningfully different from a month of zero spend.
    previousTotal: previous.count === 0 ? null : previous.total,
    projected: forecast.projected,
    byCategory: summary.byCategory,
  };

  const result = await runTask("review_spending", {
    month,
    total: figures.total,
    previousTotal: figures.previousTotal,
    projected: figures.projected,
    categories: figures.byCategory,
    budgets: budgets.map((b) => ({
      category: b.category,
      limitAmount: b.limitAmount,
      spent: b.spent,
      overspent: b.overspent,
    })),
  });

  return { month, figures, ...result };
}
