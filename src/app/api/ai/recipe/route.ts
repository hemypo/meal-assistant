import { z } from "zod";
import { auth } from "@/lib/auth";
import { AiTaskError, TASKS } from "@/lib/ai/tasks";
import { generateRecipe } from "@/server/recipes";
import { checkRateLimit } from "@/server/ratelimit";

const bodySchema = z.object({ wishes: z.string().trim().max(300).optional() });

/**
 * The client sends only free-text wishes — the server loads the pantry itself
 * (master plan §5), so the browser never has to know or send the stock list.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Требуется вход" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json({ error: "Некорректные данные" }, { status: 400 });
  }

  const limit = checkRateLimit(session.user.id, TASKS.generate_recipe.weight);
  if (!limit.ok) {
    return Response.json(
      { error: "Слишком много запросов к ИИ. Подождите немного." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } },
    );
  }

  try {
    const recipe = await generateRecipe(session.user.id, parsed.data.wishes);
    return Response.json(recipe, { status: 201 });
  } catch (error) {
    if (error instanceof AiTaskError) {
      return Response.json({ error: error.message }, { status: 422 });
    }
    console.error("[ai/recipe] generation failed");
    return Response.json({ error: "ИИ временно недоступен" }, { status: 503 });
  }
}
