import { auth } from "@/lib/auth";
import { TASKS } from "@/lib/ai/tasks";
import { buildNutritionPlan } from "@/server/settings";
import { checkRateLimit } from "@/server/ratelimit";

/**
 * Builds the personalised nutrition plan. The calorie figure is computed
 * server-side; Gemini only writes the explanation and macro split.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Требуется вход" }, { status: 401 });
  }

  const limit = checkRateLimit(session.user.id, TASKS.explain_nutrition.weight);
  if (!limit.ok) {
    return Response.json(
      { error: "Слишком много запросов к ИИ. Подождите немного." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } },
    );
  }

  const plan = await buildNutritionPlan(session.user.id);
  if (!plan) {
    return Response.json(
      {
        error:
          "Заполните профиль и запишите текущий вес — без них норму не рассчитать",
      },
      { status: 422 },
    );
  }

  return Response.json(plan);
}
