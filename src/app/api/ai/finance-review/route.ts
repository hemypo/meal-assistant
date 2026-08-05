import { auth } from "@/lib/auth";
import { AiTaskError, TASKS } from "@/lib/ai/tasks";
import { reportError } from "@/lib/observability";
import { monthSchema } from "@/lib/validation/budget";
import { buildSpendingReview } from "@/server/review";
import { checkRateLimit } from "@/server/ratelimit";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Требуется вход" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = monthSchema.safeParse(
    body?.month ?? new Date().toISOString().slice(0, 7),
  );
  if (!parsed.success) {
    return Response.json({ error: "Некорректный месяц" }, { status: 400 });
  }

  const limit = checkRateLimit(session.user.id, TASKS.review_spending.weight);
  if (!limit.ok) {
    return Response.json(
      { error: "Слишком много запросов к ИИ. Подождите немного." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } },
    );
  }

  try {
    return Response.json(
      await buildSpendingReview(session.user.id, parsed.data),
    );
  } catch (error) {
    if (error instanceof AiTaskError) {
      return Response.json({ error: error.message }, { status: 422 });
    }
    reportError("ai", error, "review_spending");
    return Response.json({ error: "ИИ временно недоступен" }, { status: 503 });
  }
}
