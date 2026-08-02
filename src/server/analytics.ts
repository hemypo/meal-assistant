import { prisma } from "@/lib/db";
import { fromIsoDate, toIsoDate } from "@/server/mealplan";
import type { CreateExpenseInput } from "@/lib/validation/finance";

export type ExpenseDTO = {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  category: string;
  amount: number;
  note: string | null;
  receiptId: string | null;
};

export type AnalyticsSummary = {
  total: number;
  count: number;
  byCategory: { category: string; amount: number; share: number }[];
  /** One bucket per day in range that has spending, ascending. */
  trend: { date: string; amount: number }[];
};

type Decimalish = { toString(): string };

const toNumber = (value: Decimalish) => Number(value.toString());

/** Money is Decimal in the DB (CLAUDE.md §4); round only at the edges. */
const round2 = (value: number) => Math.round(value * 100) / 100;

function toDTO(row: {
  id: string;
  date: Date;
  category: string;
  amount: Decimalish;
  note: string | null;
  receiptId: string | null;
}): ExpenseDTO {
  return {
    id: row.id,
    date: toIsoDate(row.date),
    category: row.category,
    amount: toNumber(row.amount),
    note: row.note,
    receiptId: row.receiptId,
  };
}

export async function listExpenses(
  userId: string,
  range: { from: string; to: string },
): Promise<ExpenseDTO[]> {
  const rows = await prisma.expense.findMany({
    where: {
      userId,
      date: { gte: fromIsoDate(range.from), lte: fromIsoDate(range.to) },
    },
    orderBy: [{ date: "desc" }, { id: "desc" }],
  });
  return rows.map(toDTO);
}

export async function createExpense(
  userId: string,
  input: CreateExpenseInput,
): Promise<ExpenseDTO> {
  const row = await prisma.expense.create({
    data: {
      userId,
      date: fromIsoDate(input.date),
      category: input.category,
      amount: input.amount,
      note: input.note ?? null,
    },
  });
  return toDTO(row);
}

export async function deleteExpense(
  userId: string,
  id: string,
): Promise<boolean> {
  const { count } = await prisma.expense.deleteMany({ where: { id, userId } });
  return count > 0;
}

/**
 * Totals, category split and daily trend for a date range.
 *
 * Aggregation happens in JS over the fetched rows rather than in SQL: the
 * volume is tiny (one household), and it keeps the arithmetic in one place
 * that tests can pin down exactly — which is what the phase's acceptance
 * criterion asks for ("charts match a hand-checked sum of the rows").
 */
export async function getSummary(
  userId: string,
  range: { from: string; to: string },
): Promise<AnalyticsSummary> {
  const rows = await prisma.expense.findMany({
    where: {
      userId,
      date: { gte: fromIsoDate(range.from), lte: fromIsoDate(range.to) },
    },
    select: { date: true, category: true, amount: true },
  });

  let total = 0;
  const categories = new Map<string, number>();
  const days = new Map<string, number>();

  for (const row of rows) {
    const amount = toNumber(row.amount);
    total += amount;
    categories.set(row.category, (categories.get(row.category) ?? 0) + amount);
    const day = toIsoDate(row.date);
    days.set(day, (days.get(day) ?? 0) + amount);
  }

  total = round2(total);

  const byCategory = [...categories.entries()]
    .map(([category, amount]) => ({
      category,
      amount: round2(amount),
      // Guard against a divide-by-zero when the range is empty.
      share: total === 0 ? 0 : round2((amount / total) * 100),
    }))
    .sort((a, b) => b.amount - a.amount);

  const trend = [...days.entries()]
    .map(([date, amount]) => ({ date, amount: round2(amount) }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return { total, count: rows.length, byCategory, trend };
}
