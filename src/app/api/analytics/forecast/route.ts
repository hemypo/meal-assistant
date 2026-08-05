import { auth } from "@/lib/auth";
import { monthSchema } from "@/lib/validation/budget";
import {
  getForecast,
  getMealCost,
  getShoppingEstimate,
} from "@/server/budgets";

/** Everything here is computed — no AI, so no rate limit needed. */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Требуется вход" }, { status: 401 });
  }

  const month =
    new URL(request.url).searchParams.get("month") ??
    new Date().toISOString().slice(0, 7);
  const parsed = monthSchema.safeParse(month);
  if (!parsed.success) {
    return Response.json({ error: "Некорректный месяц" }, { status: 400 });
  }

  const [forecast, shopping, mealCost] = await Promise.all([
    getForecast(session.user.id, parsed.data),
    getShoppingEstimate(session.user.id),
    getMealCost(session.user.id, parsed.data),
  ]);

  return Response.json({ forecast, shopping, mealCost });
}
