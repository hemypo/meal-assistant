import { z } from "zod";
import { auth } from "@/lib/auth";
import { AiTaskError, runTask, TASK_NAMES, TASKS } from "@/lib/ai/tasks";
import { checkRateLimit } from "@/server/ratelimit";

/**
 * The single AI gateway (CLAUDE.md §4). Every Gemini call in the app funnels
 * through here; a new AI-assisted field is a new task-registry entry, not a
 * new endpoint.
 */

const bodySchema = z.object({
  task: z.enum(TASK_NAMES as [string, ...string[]]),
  payload: z.unknown(),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Требуется вход" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Неизвестная ИИ-задача" }, { status: 400 });
  }

  const task = parsed.data.task as keyof typeof TASKS;
  const limit = checkRateLimit(session.user.id, TASKS[task].weight);
  if (!limit.ok) {
    return Response.json(
      { error: "Слишком много запросов к ИИ. Подождите немного." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } },
    );
  }

  try {
    const result = await runTask(task, parsed.data.payload);
    return Response.json({ result });
  } catch (error) {
    if (error instanceof AiTaskError) {
      return Response.json({ error: error.message }, { status: 422 });
    }
    // Never surface provider errors to the client — they can carry request
    // details, and CLAUDE.md §5 forbids logging anything key-adjacent.
    console.error("[ai/assist] task failed:", task);
    return Response.json({ error: "ИИ временно недоступен" }, { status: 503 });
  }
}
