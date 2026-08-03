import { z } from "zod";
import { auth } from "@/lib/auth";
import { reportError } from "@/lib/observability";
import { AiTaskError } from "@/lib/ai/tasks";
import { createProductsBulk, parseBulkText } from "@/server/bulk";
import { createProductSchema, productStatusSchema } from "@/lib/validation/product";
import { checkRateLimit } from "@/server/ratelimit";

const parseSchema = z.object({
  mode: z.literal("parse"),
  text: z.string().trim().min(1).max(5000),
});

const confirmSchema = z.object({
  mode: z.literal("confirm"),
  status: productStatusSchema,
  items: z.array(createProductSchema).min(1).max(100),
});

const bodySchema = z.discriminatedUnion("mode", [parseSchema, confirmSchema]);

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Требуется вход" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Некорректные данные" }, { status: 400 });
  }

  // Confirm is a plain database write — no AI, so no rate limit.
  if (parsed.data.mode === "confirm") {
    const products = await createProductsBulk(
      session.user.id,
      parsed.data.items,
      parsed.data.status,
    );
    return Response.json({ products }, { status: 201 });
  }

  const limit = checkRateLimit(session.user.id, 3);
  if (!limit.ok) {
    return Response.json(
      { error: "Слишком много запросов к ИИ. Подождите немного." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } },
    );
  }

  try {
    const drafts = await parseBulkText(session.user.id, parsed.data.text);
    if (drafts.length === 0) {
      return Response.json(
        { error: "Не удалось распознать ни одной позиции" },
        { status: 422 },
      );
    }
    return Response.json({ drafts });
  } catch (error) {
    if (error instanceof AiTaskError) {
      return Response.json({ error: error.message }, { status: 422 });
    }
    reportError("products", error, "bulk_parse");
    return Response.json({ error: "ИИ временно недоступен" }, { status: 503 });
  }
}
