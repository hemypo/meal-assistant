import { put } from "@vercel/blob";
import { auth } from "@/lib/auth";
import { reportError } from "@/lib/observability";
import { AiTaskError, TASKS } from "@/lib/ai/tasks";
import { createDraftReceipt, listReceipts } from "@/server/receipts";
import {
  createReceiptSchema,
  MAX_IMAGE_BYTES,
} from "@/lib/validation/receipt";
import { checkRateLimit } from "@/server/ratelimit";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Требуется вход" }, { status: 401 });
  }
  return Response.json(await listReceipts(session.user.id));
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Требуется вход" }, { status: 401 });
  }

  const parsed = createReceiptSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Некорректные данные" },
      { status: 400 },
    );
  }

  const limit = checkRateLimit(session.user.id, TASKS.parse_receipt.weight);
  if (!limit.ok) {
    return Response.json(
      { error: "Слишком много запросов к ИИ. Подождите немного." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } },
    );
  }

  let imageUrl: string | null = null;

  if (parsed.data.source === "PHOTO") {
    // base64 inflates ~4/3; check the decoded size against the 5MB cap (§7).
    const bytes = Math.floor((parsed.data.imageBase64.length * 3) / 4);
    if (bytes > MAX_IMAGE_BYTES) {
      return Response.json(
        { error: "Файл больше 5 МБ — сожмите снимок" },
        { status: 413 },
      );
    }

    try {
      const buffer = Buffer.from(parsed.data.imageBase64, "base64");
      const extension = parsed.data.mimeType.split("/")[1];
      const blob = await put(
        `receipts/${session.user.id}/${crypto.randomUUID()}.${extension}`,
        buffer,
        { access: "private", contentType: parsed.data.mimeType },
      );
      imageUrl = blob.url;
    } catch (error) {
      // Storage is a nice-to-have; parsing is the point. Carry on without it.
      reportError("receipts", error, "blob_upload");
    }
  }

  try {
    const receipt = await createDraftReceipt(
      session.user.id,
      parsed.data,
      imageUrl,
    );
    return Response.json(receipt, { status: 201 });
  } catch (error) {
    if (error instanceof AiTaskError) {
      return Response.json({ error: error.message }, { status: 422 });
    }
    reportError("receipts", error, "parse");
    return Response.json({ error: "ИИ временно недоступен" }, { status: 503 });
  }
}
